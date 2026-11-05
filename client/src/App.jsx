import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import Landing from "./pages/Landing.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import OrderStatusPage from "./pages/OrderStatusPage.jsx";
import TableBillPage from "./pages/TableBillPage.jsx";
import PaymentPage from "./pages/PaymentPage.jsx";
import BillPage from "./pages/BillPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import KitchenDisplay from "./pages/KitchenDisplay.jsx";
import AdminLayout from "./components/AdminLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import DashboardPage from "./pages/admin/DashboardPage.jsx";
import AdminMenuPage from "./pages/admin/AdminMenuPage.jsx";
import AdminTablesPage from "./pages/admin/AdminTablesPage.jsx";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage.jsx";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage.jsx";
import AdminReportsPage from "./pages/admin/AdminReportsPage.jsx";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage.jsx";
import { Logo } from "./components/Logo.jsx";
import { useDocumentTitle } from "./hooks/useApiQuery.js";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="not-found-page">
      <Logo withWordmark size={44} />
      <span className="eyebrow eyebrow--plain"><Compass size={14} /> 404 · Off the menu</span>
      <h1>This page isn't on the menu.</h1>
      <p>The link may have changed, or the page may have moved. Let's get you back to the table.</p>
      <div className="not-found-page__actions">
        <Link to="/" className="button button--primary button--md"><ArrowLeft size={16} /> Back to SmartDine</Link>
        <Link to="/admin/login" className="button button--secondary button--md">Staff sign in</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/t/:tableToken" element={<MenuPage />} />
        <Route path="/order/:orderToken" element={<OrderStatusPage />} />
        <Route path="/pay/:tableToken" element={<TableBillPage />} />
        <Route path="/payment/:sessionToken" element={<PaymentPage />} />
        <Route path="/bill/:orderToken" element={<BillPage />} />
        <Route path="/admin/login" element={<LoginPage />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allow={["admin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="menu" element={<AdminMenuPage />} />
          <Route path="tables" element={<AdminTablesPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        <Route
          path="/kitchen"
          element={
            <ProtectedRoute allow={["admin", "kitchen"]}>
              <KitchenDisplay />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
