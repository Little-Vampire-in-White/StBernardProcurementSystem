import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import Unauthorized from "./pages/OtherPage/Unauthorized";
import UserProfiles from "./pages/UserProfiles";
import UserProvisioning from "./pages/Admin/UserProvisioning";
import AuditLogs from "./pages/Admin/AuditLogs";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import Suppliers from "./pages/Procurement/Suppliers";
import PurchaseRequests from "./pages/Procurement/PurchaseRequests";
import SKTransactions from "./pages/Procurement/SKTransactions";
import ApprovalInbox from "./pages/Procurement/ApprovalInbox";
import BudgetMonitor from "./pages/Finance/BudgetMonitor";
import Reports from "./pages/Analytics/Reports";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import BarangayManagement from "./pages/BarangayManagement";
import BarangayDashboard from "./pages/BarangayDashboard";
import SKManagement from "./pages/SKManagement";
import Chat from "./pages/Chat";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Protected Dashboard Layout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index path="/" element={<Home />} />
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/messages" element={<ProtectedRoute allowedRoles={["Administrator", "MunicipalAccountant", "BudgetOfficer", "FinanceManager", "ProcurementOfficer", "DepartmentHead", "Auditor", "BarangayStaff", "BarangayTreasurer", "BarangayBookkeeper", "SKTreasurer", "SKChairman", "SKBookkeeper"]}><Chat /></ProtectedRoute>} />
            <Route path="/barangay-management" element={<ProtectedRoute allowedRoles={["BarangayBookkeeper"]}><BarangayManagement /></ProtectedRoute>} />
            <Route path="/barangay-management/:barangayId/dashboard" element={<ProtectedRoute allowedRoles={["BarangayBookkeeper"]}><BarangayDashboard /></ProtectedRoute>} />
            <Route path="/sk-management" element={<ProtectedRoute allowedRoles={["SKTreasurer", "SKChairman", "SKBookkeeper"]}><SKManagement /></ProtectedRoute>} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />
            <Route path="/form-elements" element={<FormElements />} />
            <Route path="/basic-tables" element={<BasicTables />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />
            <Route path="/procurement/suppliers" element={<Suppliers />} />
            <Route
              path="/procurement/purchase-requests"
              element={<PurchaseRequests />}
            />
            <Route path="/sk-transactions/:category" element={<ProtectedRoute allowedRoles={["MunicipalAccountant", "SKBookkeeper", "SKChairman", "SKTreasurer"]}><SKTransactions /></ProtectedRoute>} />
            <Route
              path="/procurement/approval-inbox"
              element={
                <ProtectedRoute allowedRoles={[
                  "Administrator",
                  "FinanceManager",
                ]}>
                  <ApprovalInbox />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/user-provisioning"
              element={
                <ProtectedRoute allowedRoles={["Administrator"]}>
                  <UserProvisioning />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute allowedRoles={["Administrator", "Auditor"]}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/budget-monitor"
              element={
                <ProtectedRoute allowedRoles={[
                  "Administrator",
                  "BudgetOfficer",
                  "FinanceManager",
                  "BarangayTreasurer",
                ]}>
                  <BudgetMonitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/reports"
              element={
                <ProtectedRoute allowedRoles={[
                  "Administrator",
                  "BudgetOfficer",
                  "FinanceManager",
                  "BarangayTreasurer",
                  "Auditor",
                ]}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route path="/unauthorized" element={<Unauthorized />} />
          </Route>

          {/* Public Auth Routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
