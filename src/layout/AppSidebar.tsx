import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

// Assume these icons are imported from an icon library
import {
  ChatIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PlugInIcon,
  UserCircleIcon,
} from "../icons";
import { useAuth, RoleType } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import { isRoleAllowed } from "../lib/roles";
import SidebarWidget from "./SidebarWidget";

type SubItem = {
  name: string;
  path: string;
  pro?: boolean;
  new?: boolean;
  allowedRoles?: RoleType[];
};

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  allowedRoles?: RoleType[];
  subItems?: SubItem[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [{ name: "Home", path: "/", pro: false }],
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/profile",
  },
  {
    icon: <PageIcon />,
    name: "Barangay Management",
    path: "/barangay-management",
    allowedRoles: ["BarangayBookkeeper"],
  },
  {
    icon: <PageIcon />,
    name: "Sangguniang Kabataan",
    path: "/sk-management",
    allowedRoles: ["SKTreasurer", "SKChairman", "SKBookkeeper"],
  },
  {
    icon: <PlugInIcon />,
    name: "Administration",
    allowedRoles: ["Administrator"],
    subItems: [
      {
        name: "User Provisioning",
        path: "/admin/user-provisioning",
        allowedRoles: ["Administrator"],
      },
      {
        name: "Audit Logs",
        path: "/admin/audit-logs",
        allowedRoles: ["Administrator", "Auditor"],
      },
    ],
  },
  {
    icon: <ListIcon />,
    name: "Procurement",
    subItems: [
      {
        name: "Purchase Requests",
        path: "/procurement/purchase-requests",
        allowedRoles: [
          "Requester",
          "Administrator",
          "FinanceManager",
          "BarangayStaff",
          "BarangayTreasurer",
          "BudgetOfficer",
          "ProcurementOfficer",
          "Auditor",
        ],
      },
      {
        name: "Approval Inbox",
        path: "/procurement/approval-inbox",
        allowedRoles: ["Administrator", "FinanceManager"],
      },
      {
        name: "Suppliers",
        path: "/procurement/suppliers",
        allowedRoles: ["Administrator", "BudgetOfficer", "ProcurementOfficer"],
      },
    ],
  },
  {
    icon: <PageIcon />,
    name: "Finance",
    allowedRoles: ["Administrator", "BudgetOfficer", "FinanceManager", "BarangayTreasurer"],
    subItems: [
      {
        name: "Budget Monitor",
        path: "/finance/budget-monitor",
        allowedRoles: ["Administrator", "BudgetOfficer", "FinanceManager", "BarangayTreasurer"],
      },
      {
        name: "Analytics Report",
        path: "/analytics/reports",
        allowedRoles: ["Administrator", "BudgetOfficer", "FinanceManager", "BarangayTreasurer", "Auditor"],
      },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <ChatIcon />,
    name: "Messages",
    path: "/messages",
    allowedRoles: ["Administrator", "MunicipalAccountant", "BudgetOfficer", "FinanceManager", "ProcurementOfficer", "DepartmentHead", "Auditor", "BarangayStaff", "BarangayTreasurer", "BarangayBookkeeper", "SKTreasurer", "SKChairman", "SKBookkeeper"],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { profile } = useAuth();
  const location = useLocation();
  const organizationLogo = profile?.barangaySealUrl || "/images/logo/cropped-LGU-Saint-Bernard-LOGO.png";
  const organizationName = profile?.barangayName
    ? (profile.barangayName.toLowerCase().startsWith('barangay ') ? profile.barangayName : `Barangay ${profile.barangayName}`)
    : "Municipality of Saint Bernard";

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => location.pathname === path;
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  useEffect(() => {
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const canAccess = (item: NavItem | SubItem) => {
    return isRoleAllowed(profile?.role, item.allowedRoles);
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-4">
      {items
        .filter((nav) => canAccess(nav))
        .map((nav, index) => (
          <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size  ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems
                  .filter((subItem) => canAccess(subItem))
                  .map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        to={subItem.path}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        }`}
                      >
                        {subItem.name}
                        <span className="flex items-center gap-1 ml-auto">
                          {subItem.new && (
                            <span
                              className={`ml-auto ${
                                isActive(subItem.path)
                                  ? "menu-dropdown-badge-active"
                                  : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge`}
                            >
                              new
                            </span>
                          )}
                          {subItem.pro && (
                            <span
                              className={`ml-auto ${
                                isActive(subItem.path)
                                  ? "menu-dropdown-badge-active"
                                  : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge`}
                            >
                              pro
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="flex items-center gap-3">
              <img
                className="w-12 h-12 object-contain"
                src={organizationLogo}
                alt={`${organizationName} logo`}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = "/images/logo/cropped-LGU-Saint-Bernard-LOGO.png";
                }}
                width={48}
                height={48}
              />
              <span className="text-sm font-semibold leading-tight text-gray-800 dark:text-white">
                {organizationName}
              </span>
            </div>
          ) : (
            <img
              className="w-10 h-10 object-contain"
              src={organizationLogo}
              alt={`${organizationName} logo`}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "/images/logo/cropped-LGU-Saint-Bernard-LOGO.png";
              }}
              width={40}
              height={40}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
