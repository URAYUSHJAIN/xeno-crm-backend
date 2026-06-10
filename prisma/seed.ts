import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const firstNames = [
  'Priya', 'Rohit', 'Ananya', 'Arjun', 'Kavya', 'Vikram', 'Sneha', 'Aditya',
  'Pooja', 'Rahul', 'Divya', 'Kiran', 'Meera', 'Sanjay', 'Riya', 'Amit',
  'Neha', 'Vivek', 'Shreya', 'Rajesh', 'Sunita', 'Deepak', 'Nisha', 'Harsh',
  'Aarti', 'Suresh', 'Manya', 'Nikhil', 'Tanya', 'Gaurav', 'Swati', 'Mohit',
  'Preeti', 'Varun', 'Anjali', 'Sachin', 'Simran', 'Manoj', 'Isha', 'Ramesh'
]

const lastNames = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Reddy', 'Nair', 'Joshi', 'Kumar',
  'Gupta', 'Shah', 'Mehta', 'Iyer', 'Pillai', 'Rao', 'Mishra', 'Agarwal',
  'Bose', 'Ghosh', 'Malhotra', 'Kapoor'
]

const cityWeights = [
  { city: 'Mumbai', weight: 30 },
  { city: 'Delhi', weight: 25 },
  { city: 'Bangalore', weight: 20 },
  { city: 'Chennai', weight: 12 },
  { city: 'Hyderabad', weight: 13 }
]

function randomCity(): string {
  const roll = Math.random() * 100
  let cumulative = 0
  for (const { city, weight } of cityWeights) {
    cumulative += weight
    if (roll < cumulative) return city
  }
  return 'Mumbai'
}

function randomSpend(): number {
  // Weighted toward 1500–6000
  const roll = Math.random()
  if (roll < 0.6) {
    return Math.round((1500 + Math.random() * 4500) * 100) / 100
  }
  return Math.round((500 + Math.random() * 14500) * 100) / 100
}

function randomLastOrderAt(): Date {
  const now = Date.now()
  const roll = Math.random()
  let daysAgo: number

  if (roll < 0.30) {
    // Within last 30 days
    daysAgo = Math.floor(Math.random() * 30)
  } else if (roll < 0.55) {
    // 30–90 days
    daysAgo = 30 + Math.floor(Math.random() * 60)
  } else if (roll < 0.80) {
    // 90–180 days
    daysAgo = 90 + Math.floor(Math.random() * 90)
  } else {
    // Older than 180 days
    daysAgo = 180 + Math.floor(Math.random() * 365)
  }

  return new Date(now - daysAgo * 86400000)
}

function assignTags(totalSpend: number, lastOrderAt: Date, orderCount: number): string[] {
  const tags: string[] = []
  const now = Date.now()
  const daysSinceOrder = (now - lastOrderAt.getTime()) / 86400000

  if (totalSpend > 8000) {
    tags.push('VIP')
    if (Math.random() < 0.7) tags.push('loyal')
  } else if (totalSpend >= 3000) {
    if (Math.random() < 0.6) tags.push('loyal')
  }

  if (tags.length < 2 && daysSinceOrder > 90 && totalSpend < 3000) {
    if (Math.random() < 0.7) tags.push('churned')
  }

  if (tags.length < 2 && daysSinceOrder <= 30 && orderCount === 1) {
    if (Math.random() < 0.4) tags.push('new')
  }

  return tags.slice(0, 2)
}

function generateOrders(totalSpend: number, lastOrderAt: Date): Array<{ amount: number; items: string[]; channel: string; createdAt: Date }> {
  const orderCount = 1 + Math.floor(Math.random() * 5)
  const orders = []
  let remaining = totalSpend

  const fashionItems = [
    'Kurta', 'Saree', 'Jeans', 'T-Shirt', 'Dress', 'Lehenga', 'Blazer',
    'Dupatta', 'Palazzo', 'Anarkali', 'Salwar', 'Jacket', 'Skirt', 'Shorts'
  ]

  const channels = ['online', 'store', 'app']

  for (let i = 0; i < orderCount; i++) {
    const isLast = i === orderCount - 1
    const amount = isLast
      ? Math.round(remaining * 100) / 100
      : Math.round((remaining * (0.1 + Math.random() * 0.4)) * 100) / 100

    remaining -= amount

    const itemCount = 1 + Math.floor(Math.random() * 3)
    const items: string[] = []
    for (let j = 0; j < itemCount; j++) {
      items.push(fashionItems[Math.floor(Math.random() * fashionItems.length)])
    }

    // Spread order dates before lastOrderAt
    const daysOffset = Math.floor(Math.random() * 365)
    const orderDate = new Date(lastOrderAt.getTime() - daysOffset * 86400000)

    orders.push({
      amount: Math.max(amount, 50),
      items,
      channel: channels[Math.floor(Math.random() * channels.length)],
      createdAt: orderDate
    })
  }

  // Ensure last order date matches lastOrderAt
  if (orders.length > 0) {
    orders[orders.length - 1].createdAt = lastOrderAt
  }

  return orders
}

async function main() {
  console.log('🌱 Starting seed for StyleX Fashion...')

  const customers = []

  for (let i = 0; i < 200; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const name = `${firstName} ${lastName}`
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@stylexfashion.com`
    const phone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`
    const city = randomCity()
    const totalSpend = randomSpend()
    const lastOrderAt = randomLastOrderAt()
    const orders = generateOrders(totalSpend, lastOrderAt)
    const tags = assignTags(totalSpend, lastOrderAt, orders.length)

    customers.push({ name, email, phone, city, totalSpend, lastOrderAt, tags, orders })
  }

  let created = 0

  for (const c of customers) {
    try {
      await prisma.customer.upsert({
        where: { email: c.email },
        update: {
          name: c.name,
          phone: c.phone,
          city: c.city,
          tags: c.tags,
          totalSpend: c.totalSpend,
          lastOrderAt: c.lastOrderAt,
          orders: {
            deleteMany: {},
            create: c.orders
          }
        },
        create: {
          name: c.name,
          email: c.email,
          phone: c.phone,
          city: c.city,
          tags: c.tags,
          totalSpend: c.totalSpend,
          lastOrderAt: c.lastOrderAt,
          orders: {
            create: c.orders
          }
        }
      })

      created++

      if (created % 50 === 0) {
        console.log(`  ✓ Seeded ${created}/200 customers`)
      }
    } catch (err: any) {
      console.error(`  ✗ Failed to upsert ${c.email}: ${err.message}`)
    }
  }

  console.log(`\n✅ Seeded ${created} customers`)

  // Create segments
  const now = Date.now()

  const winBackCount = await prisma.customer.count({
    where: { lastOrderAt: { lt: new Date(now - 60 * 86400000) } }
  })

  const vipCount = await prisma.customer.count({
    where: { tags: { has: 'VIP' } }
  })

  await prisma.segment.upsert({
    where: { id: 'seg-winback' },
    update: { customerCount: winBackCount },
    create: {
      id: 'seg-winback',
      name: 'Win-back: 60+ days inactive',
      rules: { lastOrderDays: 60 },
      customerCount: winBackCount
    }
  })

  await prisma.segment.upsert({
    where: { id: 'seg-vip' },
    update: { customerCount: vipCount },
    create: {
      id: 'seg-vip',
      name: 'VIP customers',
      rules: { tag: 'VIP' },
      customerCount: vipCount
    }
  })

  console.log(`\n📦 Segments created:`)
  console.log(`  • Win-back: 60+ days inactive → ${winBackCount} customers`)
  console.log(`  • VIP customers → ${vipCount} customers`)
  console.log('\n🎉 Seed complete!')
}

main()
  .catch(err => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
