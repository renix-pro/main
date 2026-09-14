/**
 * RENIX vNext — 404 Not Found Page
 * 
 * Canon v1.4 Compliant — Phase 12 Corrective
 * Uses semantic color tokens only. No gray-*.
 */

import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-background"
    >
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-status-critical" />
            <h1 
              className="text-2xl font-bold text-foreground"
            >
              404 Page Not Found
            </h1>
          </div>

          <p 
            className="mt-4 text-sm text-muted-foreground"
          >
            The requested page does not exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
