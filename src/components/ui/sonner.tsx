"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: "rounded-xl" } }}
      {...props}
    />
  );
}

export { Toaster };
