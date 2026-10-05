import { Suspense } from "react";
import SettingsPage from "@/features/management/settings";

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
