import { SidebarProvider } from "@/components/ui/sidebar";
import { PartnerSidebar } from "@/components/PartnerSidebar";
import { Outlet } from "react-router-dom";

export function PartnerLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <PartnerSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container py-6 px-4 md:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
