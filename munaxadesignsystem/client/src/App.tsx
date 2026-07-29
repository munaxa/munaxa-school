import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Tokens from "./pages/Tokens";
import Components from "./pages/Components";
import Buttons from "./pages/Buttons";
import Inputs from "./pages/Inputs";
import Cards from "./pages/Cards";
import Tables from "./pages/Tables";
import Modals from "./pages/Modals";
import Charts from "./pages/Charts";
import Accessibility from "./pages/Accessibility";
import RTL from "./pages/RTL";
import Colors from "./pages/Colors";
import Typography from "./pages/Typography";
import Patterns from "./pages/Patterns";
import Templates from "./pages/Templates";
import Examples from "./pages/Examples";
import UIKitSchoolSpecific from "./pages/UIKitSchoolSpecific";
import { AIGenerationRulesPage, DomainComponentsPage, NotificationArchitecturePage, PermissionArchitecturePage, WorkflowArchitecturePage } from "./pages/ProductArchitecture";
import SchoolDomainArchitecture from "./pages/SchoolDomainArchitecture";
import EnterpriseWorkspaceArchitecture from "./pages/EnterpriseWorkspaceArchitecture";
import EnterpriseStandards from "./pages/EnterpriseStandards";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/tokens"} component={Tokens} />
      <Route path={"/colors"} component={Colors} />
      <Route path={"/typography"} component={Typography} />
      <Route path={"/components"} component={Components} />
      <Route path={"/buttons"} component={Buttons} />
      <Route path={"/inputs"} component={Inputs} />
      <Route path={"/cards"} component={Cards} />
      <Route path={"/tables"} component={Tables} />
      <Route path={"/modals"} component={Modals} />
      <Route path={"/charts"} component={Charts} />
      <Route path={"/accessibility"} component={Accessibility} />
      <Route path={"/rtl"} component={RTL} />
      <Route path={"/patterns"} component={Patterns} />
      <Route path={"/templates"} component={Templates} />
      <Route path={"/school-components"} component={UIKitSchoolSpecific} />
      <Route path={"/examples"} component={Examples} />
      <Route path={"/product-architecture/permissions"} component={PermissionArchitecturePage} />
      <Route path={"/product-architecture/workflows"} component={WorkflowArchitecturePage} />
      <Route path={"/product-architecture/notifications"} component={NotificationArchitecturePage} />
      <Route path={"/product-architecture/domain-components"} component={DomainComponentsPage} />
      <Route path={"/product-architecture/ai-rules"} component={AIGenerationRulesPage} />
      <Route path={"/school-domain"} component={SchoolDomainArchitecture} />
      <Route path={"/enterprise-workspaces"} component={EnterpriseWorkspaceArchitecture} />
      <Route path={"/enterprise-standards"} component={EnterpriseStandards} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
