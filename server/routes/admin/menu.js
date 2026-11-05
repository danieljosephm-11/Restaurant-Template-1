import { Router } from "express";
import { db } from "../../db.js";
import {
  asyncHandler,
  HttpError,
  logAudit,
  newId,
  nowIso,
  optionalString,
  requireNumber,
  requireString,
  round2,
  toBool,
} from "../../lib/util.js";

const router = Router();

function serializeFood(food) {
  return {
    id: food.id,
    categoryId: food.category_id,
    categoryName: food.category_name,
    name: food.name,
    description: food.description,
    price: food.price,
    image: food.image,
    isVeg: !!food.is_veg,
    available: !!food.available,
    sortOrder: food.sort_order,
    createdAt: food.created_at,
    updatedAt: food.updated_at,
  };
}

function assertCategory(restaurantId, categoryId) {
  const category = db
    .query("SELECT * FROM categories WHERE id = ? AND restaurant_id = ?")
    .get(categoryId, restaurantId);
  if (!category) throw new HttpError(400, "Choose a valid menu category.");
  return category;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const categories = db
      .query(
        `SELECT c.*, (SELECT COUNT(*) FROM foods f WHERE f.category_id = c.id) AS item_count
         FROM categories c WHERE c.restaurant_id = ? ORDER BY c.sort_order, c.name`
      )
      .all(restaurantId)
      .map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sort_order,
        active: !!category.active,
        itemCount: category.item_count,
      }));
    const items = db
      .query(
        `SELECT f.*, c.name AS category_name FROM foods f JOIN categories c ON c.id = f.category_id
         WHERE f.restaurant_id = ? ORDER BY c.sort_order, f.sort_order, f.name`
      )
      .all(restaurantId)
      .map(serializeFood);
    res.json({ categories, items });
  })
);

router.post(
  "/items",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const categoryId = requireString(req.body.categoryId, "Category", { max: 80 });
    assertCategory(restaurantId, categoryId);
    const name = requireString(req.body.name, "Dish name", { max: 80 });
    const price = round2(requireNumber(req.body.price, "Price", { min: 1, max: 100_000 }));
    const description = optionalString(req.body.description, 300);
    const image = optionalString(req.body.image, 500);
    const isVeg = toBool(req.body.isVeg, true);
    const available = toBool(req.body.available, true);
    const sortOrder = requireNumber(req.body.sortOrder ?? 0, "Sort order", { min: 0, max: 999, integer: true });
    const now = nowIso();
    const id = newId("food");

    db.query(
      `INSERT INTO foods
        (id, restaurant_id, category_id, name, description, price, image, is_veg, available, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      restaurantId,
      categoryId,
      name,
      description,
      price,
      image,
      isVeg ? 1 : 0,
      available ? 1 : 0,
      sortOrder,
      now,
      now
    );
    logAudit(restaurantId, req.user.id, "menu.item_created", `${name} · ₹${price}`);
    const food = db
      .query(
        `SELECT f.*, c.name AS category_name FROM foods f JOIN categories c ON c.id = f.category_id WHERE f.id = ?`
      )
      .get(id);
    res.status(201).json({ item: serializeFood(food) });
  })
);

router.patch(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const existing = db
      .query("SELECT * FROM foods WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!existing) throw new HttpError(404, "Dish not found.");

    const categoryId =
      req.body.categoryId !== undefined ? requireString(req.body.categoryId, "Category", { max: 80 }) : existing.category_id;
    assertCategory(restaurantId, categoryId);
    const name = req.body.name !== undefined ? requireString(req.body.name, "Dish name", { max: 80 }) : existing.name;
    const price =
      req.body.price !== undefined
        ? round2(requireNumber(req.body.price, "Price", { min: 1, max: 100_000 }))
        : existing.price;
    const description =
      req.body.description !== undefined ? optionalString(req.body.description, 300) : existing.description;
    const image = req.body.image !== undefined ? optionalString(req.body.image, 500) : existing.image;
    const isVeg = req.body.isVeg !== undefined ? toBool(req.body.isVeg, true) : !!existing.is_veg;
    const available =
      req.body.available !== undefined ? toBool(req.body.available, true) : !!existing.available;
    const sortOrder =
      req.body.sortOrder !== undefined
        ? requireNumber(req.body.sortOrder, "Sort order", { min: 0, max: 999, integer: true })
        : existing.sort_order;

    db.query(
      `UPDATE foods SET category_id = ?, name = ?, description = ?, price = ?, image = ?, is_veg = ?,
       available = ?, sort_order = ?, updated_at = ? WHERE id = ? AND restaurant_id = ?`
    ).run(
      categoryId,
      name,
      description,
      price,
      image,
      isVeg ? 1 : 0,
      available ? 1 : 0,
      sortOrder,
      nowIso(),
      req.params.id,
      restaurantId
    );
    logAudit(restaurantId, req.user.id, "menu.item_updated", `${name} · ₹${price}`);

    const food = db
      .query(
        `SELECT f.*, c.name AS category_name FROM foods f JOIN categories c ON c.id = f.category_id WHERE f.id = ?`
      )
      .get(req.params.id);
    res.json({ item: serializeFood(food) });
  })
);

router.delete(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const existing = db
      .query("SELECT * FROM foods WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!existing) throw new HttpError(404, "Dish not found.");
    db.query("DELETE FROM foods WHERE id = ? AND restaurant_id = ?").run(req.params.id, restaurantId);
    logAudit(restaurantId, req.user.id, "menu.item_deleted", existing.name);
    res.json({ ok: true });
  })
);

router.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const name = requireString(req.body.name, "Category name", { max: 60 });
    const duplicate = db
      .query("SELECT id FROM categories WHERE restaurant_id = ? AND lower(name) = lower(?)")
      .get(restaurantId, name);
    if (duplicate) throw new HttpError(409, "A category with that name already exists.");
    const max = db.query("SELECT COALESCE(MAX(sort_order), 0) AS max FROM categories WHERE restaurant_id = ?").get(restaurantId);
    const sortOrder =
      req.body.sortOrder !== undefined
        ? requireNumber(req.body.sortOrder, "Sort order", { min: 0, max: 999, integer: true })
        : max.max + 1;
    const id = newId("cat");
    db.query(
      "INSERT INTO categories (id, restaurant_id, name, sort_order, active, created_at) VALUES (?,?,?,?,1,?)"
    ).run(id, restaurantId, name, sortOrder, nowIso());
    logAudit(restaurantId, req.user.id, "menu.category_created", name);
    res.status(201).json({ category: { id, name, sortOrder, active: true, itemCount: 0 } });
  })
);

router.patch(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const existing = db
      .query("SELECT * FROM categories WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!existing) throw new HttpError(404, "Category not found.");
    const name = req.body.name !== undefined ? requireString(req.body.name, "Category name", { max: 60 }) : existing.name;
    const duplicate = db
      .query("SELECT id FROM categories WHERE restaurant_id = ? AND lower(name) = lower(?) AND id <> ?")
      .get(restaurantId, name, existing.id);
    if (duplicate) throw new HttpError(409, "A category with that name already exists.");
    const sortOrder =
      req.body.sortOrder !== undefined
        ? requireNumber(req.body.sortOrder, "Sort order", { min: 0, max: 999, integer: true })
        : existing.sort_order;
    const active = req.body.active !== undefined ? toBool(req.body.active, true) : !!existing.active;
    db.query("UPDATE categories SET name = ?, sort_order = ?, active = ? WHERE id = ? AND restaurant_id = ?").run(
      name,
      sortOrder,
      active ? 1 : 0,
      existing.id,
      restaurantId
    );
    logAudit(restaurantId, req.user.id, "menu.category_updated", name);
    res.json({ category: { id: existing.id, name, sortOrder, active, itemCount: 0 } });
  })
);

router.delete(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const restaurantId = req.user.restaurant_id;
    const category = db
      .query("SELECT * FROM categories WHERE id = ? AND restaurant_id = ?")
      .get(req.params.id, restaurantId);
    if (!category) throw new HttpError(404, "Category not found.");
    const count = db.query("SELECT COUNT(*) AS count FROM foods WHERE category_id = ?").get(category.id).count;
    if (count > 0) throw new HttpError(409, "Move or delete the dishes in this category first.");
    db.query("DELETE FROM categories WHERE id = ? AND restaurant_id = ?").run(category.id, restaurantId);
    logAudit(restaurantId, req.user.id, "menu.category_deleted", category.name);
    res.json({ ok: true });
  })
);

export default router;
