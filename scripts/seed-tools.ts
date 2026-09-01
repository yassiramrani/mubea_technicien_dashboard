import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const toolsData = []

  for (let i = 1; i <= 200; i++) {
    const formattedNumber = String(i).padStart(3, '0')
    const componentName = `component-${formattedNumber}`

    toolsData.push({
      name: componentName,
      qrCode: componentName,
      status: 'AVAILABLE',
    })
  }

  console.log('Seeding 200 components into Supabase...')
  const result = await prisma.tool.createMany({
    data: toolsData,
    skipDuplicates: true,
  })

  console.log(`Successfully added ${result.count} components!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })