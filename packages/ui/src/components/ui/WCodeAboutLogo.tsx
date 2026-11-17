import { cn } from "@/components/lib/utils.js";

export function WCodeAboutLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="118"
      height="100"
      fill="none"
      viewBox="0 0 256 218"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M34 12 L 78 186 L 128 78 L 178 186 L 222 12"
        stroke="currentColor"
        strokeWidth="56"
        strokeLinejoin="miter"
        strokeMiterlimit="10"
        strokeLinecap="butt"
        fill="none"
      />
    </svg>
  );
}

export function WCodeWordmarkLogo({ className }: { className?: string }) {
  // 字标只有“WCODE”五个字母。原实现把每个字母做成独立矢量路径，
  // 手工补 W 会与原字重/字宽不一致，这里直接用文本渲染，保证字形正确且随主题取色。
  return (
    <svg
      width="244"
      height="54"
      viewBox="0 0 244 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <text
        x="0"
        y="42"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="46"
        fontWeight="700"
        letterSpacing="1.5"
      >
        WCODE
      </text>
    </svg>
  );
}
