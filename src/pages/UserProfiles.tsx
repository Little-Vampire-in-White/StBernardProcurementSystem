import PageBreadcrumb from "../components/common/PageBreadCrumb";
import UserMetaCard from "../components/UserProfile/UserMetaCard";
import UserInfoCard from "../components/UserProfile/UserInfoCard";
import UserAddressCard from "../components/UserProfile/UserAddressCard";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";

export default function UserProfiles() {
  const { profile, currentUser } = useAuth();

  return (
    <>
      <PageMeta
        title="User Profile | E-Procurement"
        description="Current user account details for the procurement and budget system."
      />
      <PageBreadcrumb pageTitle="Profile" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Profile
        </h3>
        <div className="space-y-6">
          <UserMetaCard
            name={profile?.displayName || currentUser?.displayName || "User"}
            role={profile?.role || "BarangayStaff"}
            email={profile?.email || currentUser?.email || "N/A"}
            barangay={profile?.barangayName || "Not assigned"}
            status={profile?.status || "active"}
          />
          <UserInfoCard
            name={profile?.displayName || currentUser?.displayName || "User"}
            email={profile?.email || currentUser?.email || "N/A"}
            role={profile?.role || "BarangayStaff"}
            barangay={profile?.barangayName || "Not assigned"}
            status={profile?.status || "active"}
          />
          <UserAddressCard
            barangay={profile?.barangayName || "Not assigned"}
            role={profile?.role || "BarangayStaff"}
            accountStatus={profile?.status || "active"}
          />
        </div>
      </div>
    </>
  );
}
