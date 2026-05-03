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

const OrderAcceptedEmail = ({ restaurantName, courierName, orderShortId }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu pedido fue aceptado por un repartidor</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🛵 ¡Pedido aceptado!</Heading>
        <Text style={text}>
          {restaurantName ? `Hola ${restaurantName}, ` : 'Hola, '}
          {courierName ? `${courierName} ` : 'un repartidor '}
          va en camino para recoger {orderShortId ? `el pedido #${orderShortId}` : 'tu pedido'}.
        </Text>
        <Text style={footer}>— El equipo de {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderAcceptedEmail,
  subject: '🛵 Tu pedido fue aceptado',
  displayName: 'Pedido aceptado',
  previewData: { restaurantName: 'Pizzería', courierName: 'Juan', orderShortId: 'ABC123' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a0a0a', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: '0 0 22px' }
const footer = { fontSize: '12px', color: '#999', margin: '28px 0 0' }
