import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = '1-Click'

interface Props {
  restaurantName?: string
  orderShortId?: string
}

const OrderDeliveredEmail = ({ restaurantName, orderShortId }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu pedido fue entregado</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>✅ Pedido entregado</Heading>
        <Text style={text}>
          {restaurantName ? `Hola ${restaurantName}, ` : 'Hola, '}
          {orderShortId ? `el pedido #${orderShortId} ` : 'el pedido '}
          fue entregado correctamente al cliente. ¡Gracias por usar {SITE_NAME}!
        </Text>
        <Text style={footer}>— El equipo de {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderDeliveredEmail,
  subject: '✅ Pedido entregado',
  displayName: 'Pedido entregado',
  previewData: { restaurantName: 'Pizzería', orderShortId: 'ABC123' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a0a0a', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: '0 0 22px' }
const footer = { fontSize: '12px', color: '#999', margin: '28px 0 0' }
