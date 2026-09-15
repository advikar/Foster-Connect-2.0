import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { PartnerLayout } from "./components/layout/PartnerLayout";
import { AppLayout } from "./components/layout/AppLayout";
import { ErrorFallback, NotFoundPage } from "./components/safety/ErrorFallback";

const PartnerSignIn = lazy(() => import("./pages/PartnerPages").then(module => ({ default: module.PartnerSignIn })));
const PartnerLanding = lazy(() => import("./pages/PartnerPages").then(module => ({ default: module.PartnerLanding })));
const PartnerOverview = lazy(() => import("./pages/PartnerPages").then(module => ({ default: module.PartnerOverview })));
const PartnerSubmissions = lazy(() => import("./pages/PartnerPages").then(module => ({ default: module.PartnerSubmissions })));
const PartnerAddResource = lazy(() => import("./pages/PartnerPages").then(module => ({ default: module.PartnerAddResource })));
const PartnerCoverage = lazy(() => import("./pages/PartnerPages").then(module => ({ default: module.PartnerCoverage })));
const PartnerReview = lazy(() => import("./pages/PartnerPages").then(module => ({ default: module.PartnerReview })));
const PartnerGuide = lazy(() => import("./pages/PartnerPages").then(module => ({ default: module.PartnerGuide })));
const HomePage = lazy(() => import("./pages/HomePage").then(module => ({ default: module.HomePage })));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage").then(module => ({ default: module.ResourcesPage })));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage").then(module => ({ default: module.RoadmapPage })));
const AddResourcePage = lazy(() => import("./pages/AddResourcePage").then(module => ({ default: module.AddResourcePage })));
const AskPage = lazy(() => import("./pages/AskPage").then(module => ({ default: module.AskPage })));
const SavedPage = lazy(() => import("./pages/SavedPage").then(module => ({ default: module.SavedPage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then(module => ({ default: module.PrivacyPage })));

function page(content: ReactNode) {
  return <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-brand" /></div>}>{content}</Suspense>;
}

export const router = createBrowserRouter([{
  element: <AppLayout />,
  // Any thrown route error renders a page with working crisis numbers
  // instead of the blank white screen this used to produce.
  errorElement: <ErrorFallback />,
  children: [
  { path: "/", element: page(<HomePage />) },
  { path: "/resources", element: page(<ResourcesPage />) },
  { path: "/ask", element: page(<AskPage />) },
  { path: "/roadmap", element: page(<RoadmapPage />) },
  { path: "/saved", element: page(<SavedPage />) },
  { path: "/add-resource", element: page(<AddResourcePage />) },
  { path: "/privacy", element: page(<PrivacyPage />) },
  { path: "*", element: <NotFoundPage /> },
]}, {
  path: "/partners", element: <PartnerLayout />, errorElement: <ErrorFallback />,
  children: [
    { index: true, element: page(<PartnerLanding />) },
    { path: "sign-in", element: page(<PartnerSignIn />) },
    { path: "overview", element: page(<PartnerOverview />) },
    { path: "submissions", element: page(<PartnerSubmissions />) },
    { path: "add-resource", element: page(<PartnerAddResource />) },
    { path: "coverage", element: page(<PartnerCoverage />) },
    { path: "review", element: page(<PartnerReview />) },
    { path: "guide", element: page(<PartnerGuide />) },
    { path: "*", element: <NotFoundPage /> },
  ],
}], { basename: import.meta.env.BASE_URL });
