# 1Click

Desarrolla una aplicación web progresiva (PWA) llamada "1-Click" para conectar Restaurantes con Repartidores independientes en Cancún. El objetivo es profesionalizar la logística que actualmente ocurre en grupos de WhatsApp.

Roles de Usuario y Onboarding:

Restaurante: Registro con Nombre del local, Dirección (Google Maps API), Teléfono y Categoría de comida.

Repartidor: Registro riguroso con carga de documentos: Foto de INE (frente/vuelta), Licencia, Foto de Moto, Placa, Foto de Mochila de reparto y Ubicación de domicilio. Los repartidores inician en estado "Pendiente de Validación".

Modelo de Negocio del Repartidor (Lógica Core): El repartidor debe poder elegir y cambiar entre dos modelos en su perfil:

Modelo PPS (Pago por Servicio): Se le descuentan $5 MXN por cada pedido finalizado. Requiere un "Monedero Digital" que el repartidor recarga. Si el saldo es < $5, no puede aceptar pedidos.

Modelo Suscripción: $249 MXN mensuales por acceso ilimitado (comisión $0).

Regla de Cambio: Si el usuario tiene Suscripción activa y cambia a PPS, la suscripción se mantiene vigente hasta que termine el mes pagado (no hay reembolsos). El cobro de $5 inicia al vencer la suscripción.

Funcionalidades en Vivo (Live Workflow):

Dashboard Restaurante: Botón central "Solicitar Repartidor". Al dar click, ingresa detalles (Destino, Monto a cobrar al cliente, ID de pedido). Lanza una alerta en tiempo real a los repartidores cercanos.

Dashboard Repartidor: Feed de pedidos disponibles en tiempo real. Al aceptar uno, el pedido se bloquea para otros. Mapa con ruta (Restaurante -> Cliente).

Estados del Pedido: Pendiente -> Asignado -> En Camino -> Entregado.

Notificaciones: Notificar al restaurante cuando el repartidor acepte y cuando entregue.

Interfaz de Usuario (UI/UX):

Diseño Mobile-First, limpio y moderno.

Colores: Verde vibrante y negro (estilo logística rápida).

Vistas:

Login/Register con selector de rol.

Perfil de Repartidor con "Wallet" (Monedero) y selector de Plan.

Historial de entregas y ganancias para ambos roles.

Requerimientos Técnicos:

Uso de Supabase para la base de datos y autenticación.

Tablas: profiles, orders, wallet_transactions, subscriptions.

Implementar estados de validación para documentos del repartidor (Admin manual por ahora).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://oneclick-delivery-link.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/944f0876-4978-49ab-8426-84c1cdc9047f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
