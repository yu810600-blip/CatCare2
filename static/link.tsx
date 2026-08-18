/**
 * 靜態版沒有伺服器可以處理 /body 這種路徑，改走 hash 路由。
 * vite.static.config.ts 會把 next/link 指到這裡，CatCareApp 不用改。
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode };

export default function Link({ href, children, ...rest }: Props) {
  return <a href={`#${href}`} {...rest}>{children}</a>;
}
