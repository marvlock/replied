"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 stroke-[3px]" />,
        info: <InfoIcon className="size-4 stroke-[3px]" />,
        warning: <TriangleAlertIcon className="size-4 stroke-[3px]" />,
        error: <OctagonXIcon className="size-4 stroke-[3px]" />,
        loading: <Loader2Icon className="size-4 animate-spin stroke-[3px]" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-full font-black uppercase tracking-widest text-sm border-4 border-black px-4 py-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white text-black",
          success:
            "bg-[#D4FF00] text-black border-black",
          error:
            "bg-black text-white border-black [&_[data-icon]]:text-[#FF4040]",
          warning:
            "bg-[#FF80FF] text-black border-black",
          info:
            "bg-[#1C7BFF] text-black border-black",
          loading:
            "bg-white text-black border-black",
          title: "font-black uppercase tracking-widest text-sm",
          description: "text-xs font-bold uppercase opacity-70 tracking-wider mt-0.5",
          icon: "flex-shrink-0",
          actionButton:
            "bg-black text-white font-black uppercase text-xs px-3 py-1 border-2 border-black hover:bg-white hover:text-black transition-colors",
          cancelButton:
            "bg-white text-black font-black uppercase text-xs px-3 py-1 border-2 border-black hover:bg-black hover:text-white transition-colors",
          closeButton:
            "border-2 border-black bg-white hover:bg-black hover:text-white transition-colors",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
