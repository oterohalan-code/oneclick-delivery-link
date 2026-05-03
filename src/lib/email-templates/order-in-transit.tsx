import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = '1-Click'

interface Props {
  restaurantName?: string
  courierName?: string
  orderShortId?: string
}

const OrderInTransitEmail = ({ restaurantName, courierName, orderShortId }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu repartidor ya está en camino al cliente</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🚚 Pedido en camino</Heading>
        <Text style={text}>
          {restaurantName ? `Hola ${restaurantName}, ` : 'Hola, '}
          {courierName ? `${courierName} ` : 'el repartidor '}
          recogió {orderShortId ? `el pedido #${orderShortId}` : 'el pedido'} y va camino al cliente.
        </Text>
        <Text style={footer}>— El equipo de {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderInTransitEmail,
  subject: '🚚 Pedido en camino',
  displayName: 'Pedido en camino',
  previewData: { restaurantName: 'Pizzería', courierName: 'Juan', orderShortId: 'ABC123' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a0a0a', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: '0 0 22px' }
const footer = { fontSize: '12px', color: '#999', margin: '28px 0 0' }
