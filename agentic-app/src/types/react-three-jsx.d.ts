import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      meshStandardMaterial: Record<string, unknown>;
      [elementName: string]: Record<string, unknown>;
    }
  }
}
