import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Generates a random 12-character uppercase string (e.g., YBVRKDHPDCCN)
function generateRandomCode(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function main() {
  // 1. Delete dependent logs first to prevent the Foreign Key crash
  console.log('Cleaning up old logs for auto-generated components...')
  await prisma.log.deleteMany({
    where: {
      tool: { name: { startsWith: 'component-' } }
    }
  })

  // 2. Now delete the old tools
  console.log('Cleaning up old auto-generated components...')
  await prisma.tool.deleteMany({
    where: { name: { startsWith: 'component-' } }
  })

  const toolsData = []
  console.log('Preparing 200 components with secure QR codes...')

  for (let i = 1; i <= 200; i++) {
    const formattedNumber = String(i).padStart(3, '0')
    const componentName = `component-${formattedNumber}`
    
    toolsData.push({
      name: componentName,
      qrCode: generateRandomCode(12),
      status: 'AVAILABLE',
      // The 'image' field is left empty since we are not storing physical files
    })
  }

  // 3. Insert the new securely-coded tools into Supabase
  const result = await prisma.tool.createMany({
    data: toolsData,
    skipDuplicates: true,
  })

  console.log(`Successfully added ${result.count} components to the database!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })