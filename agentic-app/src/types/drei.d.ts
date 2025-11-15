declare module "@react-three/drei/core/OrbitControls" {
  import type { ForwardRefExoticComponent, RefAttributes } from "react";
  import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

  type OrbitControlsProps = Record<string, unknown>;

  const OrbitControls: ForwardRefExoticComponent<
    OrbitControlsProps & RefAttributes<OrbitControlsImpl>
  >;
  export { OrbitControls };
  export default OrbitControls;
}
