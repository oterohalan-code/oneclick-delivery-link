import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrders from "./tools/list-orders";
import getWallet from "./tools/get-wallet";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "1click",
  title: "1Click",
  version: "0.1.0",
  instructions: "Herramientas de 1Click (logística de entregas en Manzanillo, Colima). Consulta tus pedidos y el monedero de repartidor como el usuario que inició sesión.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrders, getWallet],
});
