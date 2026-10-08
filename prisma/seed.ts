import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.upsert({
    where: { code: 'BPR-001' },
    update: {},
    create: {
      code: 'BPR-001',
      name: 'BPR Utama',
      branches: {
        create: {
          code: 'BR-001',
          name: 'Kantor Pusat',
        }
      }
    }
  })

  const branch = await prisma.branch.findFirst({ where: { organizationId: org.id } })

  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: {
      code: 'ADMIN',
      name: 'Super Admin',
      isSystem: true,
    }
  })

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@bpr.com' },
    update: {},
    create: {
      email: 'admin@bpr.com',
      passwordHash: 'admin123', // IN PRODUCTION, HASH THIS
      fullName: 'Administrator',
      organizationId: org.id,
      branchId: branch?.id,
      userRoles: {
        create: {
          roleId: adminRole.id
        }
      }
    }
  })

  // Seed Sample Leads
  const existingLeads = await prisma.lead.count({ where: { organizationId: org.id } })
  if (existingLeads === 0) {
    await prisma.lead.createMany({
      data: [
        {
          organizationId: org.id,
          branchId: branch?.id,
          name: 'Budi Santoso',
          phone: '081234567890',
          address: 'Jl. Merdeka No. 45, Denpasar',
          source: 'Website',
          productInterest: 'Kredit Modal Kerja',
          status: 'NEW',
          notes: 'Mencari pinjaman modal usaha toko sembako Rp 50jt',
          assignedOfficerId: adminUser.id,
        },
        {
          organizationId: org.id,
          branchId: branch?.id,
          name: 'Ni Wayan Sari',
          phone: '085798765432',
          address: 'Jl. Gatot Subroto No. 12, Tabanan',
          source: 'Walk-in',
          productInterest: 'Kredit Konsumtif',
          status: 'CONTACTED',
          notes: 'Kebutuhan renovasi rumah Rp 100jt, sudah dihubungi via WA',
          assignedOfficerId: adminUser.id,
        },
        {
          organizationId: org.id,
          branchId: branch?.id,
          name: 'I Made Sudirga',
          phone: '087811223344',
          address: 'Jl. Sunset Road No. 88, Badung',
          source: 'Referral',
          productInterest: 'Kredit Investasi',
          status: 'QUALIFIED',
          notes: 'Usaha penginapan villa, butuh ekspansi Rp 300jt. Dokumen awal sudah lengkap.',
          assignedOfficerId: adminUser.id,
        }
      ]
    })
    console.log('Sample leads seeded successfully.')
  }

  // Seed sample credit applications
  const existingAppCount = await prisma.creditApplication.count()
  if (existingAppCount === 0) {
    await prisma.creditApplication.createMany({
      data: [
        {
          organizationId: org.id,
          branchId: branch?.id,
          applicationNumber: 'KRD-2026-0001',
          applicantId: adminUser.id,
          product: 'Kredit Modal Kerja',
          requestedAmount: 50000000,
          requestedTenorMonths: 24,
          purpose: 'Ekspansi stok dagangan minimarket',
          source: 'Website',
          assignedMarketingOfficerId: adminUser.id,
          status: 'SUBMITTED',
          submissionDate: new Date(),
          notes: 'Nasabah prospektif dengan cashflow stabil.'
        },
        {
          organizationId: org.id,
          branchId: branch?.id,
          applicationNumber: 'KRD-2026-0002',
          applicantId: adminUser.id,
          product: 'Kredit Multi Guna',
          requestedAmount: 150000000,
          requestedTenorMonths: 36,
          purpose: 'Renovasi ruko operasional',
          source: 'Walk-in',
          assignedMarketingOfficerId: adminUser.id,
          assignedAnalystId: adminUser.id,
          status: 'ANALYSIS',
          submissionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          notes: 'Sedang menunggu dokumen rekening koran 3 bulan terakhir.'
        },
        {
          organizationId: org.id,
          branchId: branch?.id,
          applicationNumber: 'KRD-2026-0003',
          applicantId: adminUser.id,
          product: 'Kredit Investasi Usaha',
          requestedAmount: 300000000,
          requestedTenorMonths: 60,
          purpose: 'Pembelian mesin penggiling kopi & roaster modern',
          source: 'Referral',
          assignedMarketingOfficerId: adminUser.id,
          assignedAnalystId: adminUser.id,
          assignedSurveyOfficerId: adminUser.id,
          status: 'APPROVED',
          submissionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          notes: 'Disetujui oleh Komite Kredit. Menunggu proses akad kredit.'
        }
      ]
    })
    console.log('Sample credit applications seeded successfully.')
  }

  // Seed BPR Roles
  const bmRole = await prisma.role.upsert({
    where: { code: 'BRANCH_MANAGER' },
    update: {},
    create: {
      code: 'BRANCH_MANAGER',
      name: 'Kepala Cabang (Branch Manager)',
      description: 'Otoritas persetujuan kredit mikro/retail s.d. Rp 50 Juta'
    }
  })

  const commRole = await prisma.role.upsert({
    where: { code: 'CREDIT_COMMITTEE' },
    update: {},
    create: {
      code: 'CREDIT_COMMITTEE',
      name: 'Komite Kredit Cabang',
      description: 'Otoritas persetujuan kredit menengah s.d. Rp 250 Juta'
    }
  })

  const dirRole = await prisma.role.upsert({
    where: { code: 'DIRECTOR' },
    update: {},
    create: {
      code: 'DIRECTOR',
      name: 'Direksi / Komite Kredit Pusat',
      description: 'Otoritas persetujuan kredit di atas Rp 250 Juta'
    }
  })

  await prisma.role.upsert({
    where: { code: 'CREDIT_ANALYST' },
    update: {},
    create: {
      code: 'CREDIT_ANALYST',
      name: 'Analis Kredit (Credit Analyst)',
      description: 'Verifikasi berkas, analisis kelayakan 5C, dan rekomendasi'
    }
  })

  await prisma.role.upsert({
    where: { code: 'AO_MARKETING' },
    update: {},
    create: {
      code: 'AO_MARKETING',
      name: 'Account Officer (Marketing)',
      description: 'Akuisisi debitur baru dan pengajuan awal'
    }
  })

  // Assign DIRECTOR role to adminUser as well so admin can test any tier
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: dirRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: dirRole.id }
  })

  // Seed Credit Approval Limits
  const existingLimits = await prisma.creditApprovalLimit.count({ where: { organizationId: org.id } })
  if (existingLimits === 0) {
    await prisma.creditApprovalLimit.createMany({
      data: [
        {
          organizationId: org.id,
          roleId: bmRole.id,
          levelName: 'Tier 1 - Kepala Cabang',
          minAmount: 0,
          maxAmount: 50000000,
          tierOrder: 1,
        },
        {
          organizationId: org.id,
          roleId: commRole.id,
          levelName: 'Tier 2 - Komite Kredit Cabang',
          minAmount: 50000001,
          maxAmount: 250000000,
          tierOrder: 2,
        },
        {
          organizationId: org.id,
          roleId: dirRole.id,
          levelName: 'Tier 3 - Direksi / Komite Pusat',
          minAmount: 250000001,
          maxAmount: 10000000000,
          tierOrder: 3,
        }
      ]
    })
    console.log('Credit approval limits seeded successfully.')
  }

  // Seed Sample Field Tasks (Section 15 & 16)
  const existingTaskCount = await prisma.fieldTask.count({ where: { organizationId: org.id } })
  if (existingTaskCount === 0) {
    const firstApp = await prisma.creditApplication.findFirst({ where: { organizationId: org.id } })
    const firstLead = await prisma.lead.findFirst({ where: { organizationId: org.id } })

    await prisma.fieldTask.createMany({
      data: [
        {
          organizationId: org.id,
          branchId: branch?.id,
          assignedOfficerId: adminUser.id,
          creditApplicationId: firstApp?.id,
          taskType: 'SURVEY',
          priority: 'HIGH',
          status: 'COMPLETED',
          title: 'Survey Fisik Lokasi Usaha & Agunan Toko Sembako',
          description: 'Cek stok barang, wawancara debitur, dan foto sertifikat SHM di lokasi Denpasar.',
          customerName: 'Budi Santoso',
          customerPhone: '081234567890',
          customerAddress: 'Jl. Merdeka No. 45, Denpasar',
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          resultNotes: 'Usaha aktif dan ramai pembeli. Omset harian berkisar Rp 2-3jt. Agunan sesuai fisik.',
        },
        {
          organizationId: org.id,
          branchId: branch?.id,
          assignedOfficerId: adminUser.id,
          leadId: firstLead?.id,
          taskType: 'CUSTOMER_VISIT',
          priority: 'MEDIUM',
          status: 'IN_PROGRESS',
          title: 'Kunjungan Follow-up Calon Debitur Tabungan & Kredit',
          description: 'Penjelasan rincian simulasi angsuran dan persyaratan berkas KTP/KK.',
          customerName: 'Ni Wayan Sari',
          customerPhone: '085798765432',
          customerAddress: 'Jl. Gatot Subroto No. 12, Tabanan',
          dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          resultNotes: 'Nasabah berminat, jadwal temu pukul 14:00 WITA.',
        },
        {
          organizationId: org.id,
          branchId: branch?.id,
          assignedOfficerId: adminUser.id,
          taskType: 'DOCUMENT_PICKUP',
          priority: 'URGENT',
          status: 'PENDING',
          title: 'Pengambilan Berkas Rekening Koran 3 Bulan Terakhir',
          description: 'Ambil berkas asli rekening bank dari nasabah untuk kelengkapan berkas komite.',
          customerName: 'I Made Sudirga',
          customerPhone: '087811223344',
          customerAddress: 'Jl. Sunset Road No. 88, Badung',
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      ],
    })
    console.log('Sample field tasks seeded successfully.')
  }

  // Seed Sample Documents (Section 17)
  const existingDocCount = await prisma.document.count({ where: { organizationId: org.id } })
  if (existingDocCount === 0) {
    const firstApp = await prisma.creditApplication.findFirst({ where: { organizationId: org.id } })
    if (firstApp) {
      await prisma.document.createMany({
        data: [
          {
            organizationId: org.id,
            ownerType: 'CREDIT_APPLICATION',
            ownerId: firstApp.id,
            documentType: 'KTP',
            fileName: 'KTP_Debitur_Budi_Santoso.pdf',
            filePath: '/uploads/documents/ktp-budi.pdf',
            fileExt: 'pdf',
            fileSize: 450200,
            mimeType: 'application/pdf',
            uploadedById: adminUser.id,
            status: 'ACTIVE',
            notes: 'KTP elektronik asli terverifikasi.',
          },
          {
            organizationId: org.id,
            ownerType: 'CREDIT_APPLICATION',
            ownerId: firstApp.id,
            documentType: 'COLLATERAL_DOC',
            fileName: 'Sertifikat_SHM_No_1284_Denpasar.pdf',
            filePath: '/uploads/documents/shm-1284.pdf',
            fileExt: 'pdf',
            fileSize: 1850400,
            mimeType: 'application/pdf',
            uploadedById: adminUser.id,
            status: 'ACTIVE',
            notes: 'SHM atas nama pemohon langsung.',
          },
          {
            organizationId: org.id,
            ownerType: 'CREDIT_APPLICATION',
            ownerId: firstApp.id,
            documentType: 'SURVEY_PHOTO',
            fileName: 'Foto_Usaha_Toko_Sembako.jpg',
            filePath: '/uploads/documents/foto-toko.jpg',
            fileExt: 'jpg',
            fileSize: 820100,
            mimeType: 'image/jpeg',
            uploadedById: adminUser.id,
            status: 'ACTIVE',
            notes: 'Foto tampak depan dan persediaan barang dagangan.',
          },
        ],
      })
      console.log('Sample documents seeded successfully.')
    }
  }

  // Seed sample Inventory Items
  const existingInventory = await prisma.inventoryItem.count({ where: { organizationId: org.id } })
  if (existingInventory === 0) {
    const item1 = await prisma.inventoryItem.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        itemCode: 'INV-KRT-001',
        name: 'Kertas HVS A4 80gr PaperOne',
        category: 'Formulir & Kertas',
        unit: 'Rim',
        currentStock: 45,
        minStock: 10,
        storageLocation: 'Gudang Lt. 1 / Rak A1',
        unitPrice: 58000,
        notes: 'Kertas standar pencetakan akad dan berkas kredit',
        transactions: {
          create: {
            type: 'STOCK_IN',
            quantity: 50,
            stockBefore: 0,
            stockAfter: 50,
            referenceNumber: 'PO-2026-0012',
            notes: 'Penerimaan stok awal dari Toko Gramedia',
            performedById: adminUser.id,
          }
        }
      }
    })

    const item2 = await prisma.inventoryItem.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        itemCode: 'INV-TNR-002',
        name: 'Toner HP LaserJet 85A Original',
        category: 'Toner & Cartridge',
        unit: 'Box',
        currentStock: 3,
        minStock: 5, // Triggers low stock alert
        storageLocation: 'Gudang Lt. 1 / Lemari IT-02',
        unitPrice: 950000,
        notes: 'Persediaan printer dokumen customer service dan analis',
        transactions: {
          create: {
            type: 'STOCK_IN',
            quantity: 5,
            stockBefore: 0,
            stockAfter: 5,
            referenceNumber: 'PO-2026-0018',
            notes: 'Penerimaan toner HP resmi',
            performedById: adminUser.id,
          }
        }
      }
    })

    const item3 = await prisma.inventoryItem.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        itemCode: 'INV-ATK-003',
        name: 'Pulpen Gel Pilot G2 0.7mm Hitam',
        category: 'ATK',
        unit: 'Lusin',
        currentStock: 12,
        minStock: 4,
        storageLocation: 'Gudang Lt. 1 / Rak ATK-3',
        unitPrice: 185000,
        notes: 'Pulpen tanda tangan akad dan nasabah',
      }
    })

    const item4 = await prisma.inventoryItem.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        itemCode: 'INV-DOC-004',
        name: 'Buku Tabungan BPR Adiartha Cetak Eksklusif',
        category: 'Formulir & Kertas',
        unit: 'Pcs',
        currentStock: 2,
        minStock: 50, // Critical low stock alert
        storageLocation: 'Ruang Khazanah / Lemari Blanko',
        unitPrice: 15000,
        notes: 'Blanko berhologram resmi BPR, butuh segera reorder',
      }
    })

    console.log('Sample inventory items seeded successfully.')
  }

  // Seed sample Assets
  const existingAssets = await prisma.asset.count({ where: { organizationId: org.id } })
  if (existingAssets === 0) {
    const asset1 = await prisma.asset.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        assetNumber: 'AST-IT-2026-001',
        name: 'Laptop Lenovo ThinkPad L14 Gen 4 Core i7',
        category: 'IT Equipment',
        serialNumber: 'PF49B9921',
        purchaseDate: new Date('2026-01-15'),
        purchasePrice: 16500000,
        vendor: 'PT Sentra Pratama Komputer',
        warrantyExpiry: new Date('2029-01-15'),
        location: 'Kantor Pusat - Ruang Analis Lt. 2',
        currentHolderId: adminUser.id,
        condition: 'GOOD',
        status: 'ASSIGNED',
        notes: 'Perangkat kerja operasional kredit dan analisis',
        histories: {
          create: [
            {
              action: 'PURCHASE',
              condition: 'GOOD',
              status: 'PURCHASED',
              notes: 'Pengadaan laptop baru via PO-2026-0005',
              performedById: adminUser.id,
            },
            {
              action: 'ASSIGNMENT',
              toHolderId: adminUser.id,
              toLocation: 'Kantor Pusat - Ruang Analis Lt. 2',
              condition: 'GOOD',
              status: 'ASSIGNED',
              notes: 'Serah terima laptop kepada Administrator Operasional',
              performedById: adminUser.id,
            }
          ]
        }
      }
    })

    const asset2 = await prisma.asset.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        assetNumber: 'AST-VH-2025-004',
        name: 'Sepeda Motor Honda Vario 125 CBS ISS',
        category: 'Kendaraan Operasional',
        serialNumber: 'MH1JM3119PK128490',
        purchaseDate: new Date('2025-05-10'),
        purchasePrice: 24300000,
        vendor: 'Astra Motor Denpasar',
        warrantyExpiry: new Date('2028-05-10'),
        location: 'Parkir Operasional Lapangan',
        currentHolderId: adminUser.id,
        condition: 'GOOD',
        status: 'ASSIGNED',
        notes: 'Plat DK 4521 AA. Kendaraan dinas field officer untuk survey lapangan nasabah.',
        histories: {
          create: [
            {
              action: 'PURCHASE',
              condition: 'GOOD',
              status: 'PURCHASED',
              notes: 'Pengadaan unit sepeda motor dinas lapangan',
              performedById: adminUser.id,
            },
            {
              action: 'ASSIGNMENT',
              toHolderId: adminUser.id,
              toLocation: 'Parkir Operasional Lapangan',
              condition: 'GOOD',
              status: 'ASSIGNED',
              notes: 'Diserahkan kepada Petugas Lapangan untuk kegiatan OTS / Survey Kredit',
              performedById: adminUser.id,
            }
          ]
        },
        maintenances: {
          create: {
            title: 'Servis Berkala & Ganti Oli 10.000 KM',
            description: 'Penggantian oli mesin, oli gardan, busi, dan pembersihan CVT',
            cost: 285000,
            vendor: 'AHASS Astra Motor Denpasar',
            technician: 'Ketut Sudarma',
            startDate: new Date('2026-02-10'),
            completionDate: new Date('2026-02-10'),
            status: 'COMPLETED',
            notes: 'Kondisi kendaraan sangat prima siap jelajah survey',
            performedById: adminUser.id,
          }
        }
      }
    })

    const asset3 = await prisma.asset.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        assetNumber: 'AST-PRN-2025-008',
        name: 'Printer Multifungsi Epson EcoTank L3210',
        category: 'IT Equipment',
        serialNumber: 'X8Y4091823',
        purchaseDate: new Date('2025-08-20'),
        purchasePrice: 2850000,
        vendor: 'Bali Digital Solusindo',
        warrantyExpiry: new Date('2027-08-20'),
        location: 'Ruang Customer Service Lt. 1',
        condition: 'FAIR',
        status: 'MAINTENANCE',
        notes: 'Head printer bergaris, sedang proses perbaikan berkala',
        histories: {
          create: [
            {
              action: 'PURCHASE',
              condition: 'GOOD',
              status: 'PURCHASED',
              notes: 'Pembelian printer kantor CS',
              performedById: adminUser.id,
            },
            {
              action: 'MAINTENANCE',
              fromLocation: 'Ruang Customer Service Lt. 1',
              toLocation: 'Service Center Epson Teuku Umar',
              condition: 'FAIR',
              status: 'MAINTENANCE',
              notes: 'Dikirim ke service center untuk deep head cleaning',
              performedById: adminUser.id,
            }
          ]
        },
        maintenances: {
          create: {
            title: 'Perbaikan Printhead Bergaris',
            description: 'Pembersihan nozel dan flushing tabung tinta hitam',
            cost: 175000,
            vendor: 'Epson Service Center Teuku Umar',
            technician: 'Wayan Arka',
            startDate: new Date('2026-03-25'),
            status: 'IN_PROGRESS',
            notes: 'Menunggu penggantian komponen damper',
            performedById: adminUser.id,
          }
        }
      }
    })

    const asset4 = await prisma.asset.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        assetNumber: 'AST-SEC-2024-002',
        name: 'Brankas Khasanah Tahan Api Chubb Safes Europa Grade 3',
        category: 'Office Furniture',
        serialNumber: 'CHB-EU3-88912',
        purchaseDate: new Date('2024-03-12'),
        purchasePrice: 68000000,
        vendor: 'PT Chubb Safes Indonesia',
        location: 'Ruang Khazanah Utama BPR',
        condition: 'GOOD',
        status: 'ASSIGNED',
        notes: 'Penyimpanan jaminan sertifikat SHM dan bilyet deposito berharga',
      }
    })

    console.log('Sample assets seeded successfully.')
  }

  // Seed sample Vendors
  const existingVendors = await prisma.vendor.count({ where: { organizationId: org.id } })
  if (existingVendors === 0) {
    const v1 = await prisma.vendor.create({
      data: {
        organizationId: org.id,
        code: 'VND-001',
        name: 'PT Sentra Pratama Komputer',
        category: 'IT & Komputer',
        contactPerson: 'Bpk. Hendra Gunawan',
        phone: '081234889900',
        email: 'sales@sentrapratama.co.id',
        address: 'Jl. Teuku Umar No. 120, Denpasar',
        bankName: 'BCA',
        bankAccount: '0408891234',
        bankHolder: 'PT Sentra Pratama Komputer',
      }
    })

    const v2 = await prisma.vendor.create({
      data: {
        organizationId: org.id,
        code: 'VND-002',
        name: 'CV Bali Grafika Offset & Cetak',
        category: 'Percetakan & Formulir',
        contactPerson: 'I Made Sukerta',
        phone: '081999223344',
        email: 'order@baligrafika.com',
        address: 'Jl. Hayam Wuruk No. 85, Denpasar',
        bankName: 'Bank BPD Bali',
        bankAccount: '0100203040',
        bankHolder: 'CV Bali Grafika Offset',
      }
    })

    const v3 = await prisma.vendor.create({
      data: {
        organizationId: org.id,
        code: 'VND-003',
        name: 'Toko Buku & ATK Gramedia Denpasar',
        category: 'Alat Tulis Kantor',
        contactPerson: 'Ibu Ratna',
        phone: '0361228899',
        email: 'denpasar@gramedia.id',
        address: 'Jl. Jendral Sudirman No. 1, Denpasar',
        bankName: 'Mandiri',
        bankAccount: '145000123987',
        bankHolder: 'PT Gramedia Asri Media',
      }
    })

    console.log('Sample vendors seeded successfully.')

    // Seed Workflow
    const workflow = await prisma.workflow.create({
      data: {
        organizationId: org.id,
        module: 'PURCHASING',
        name: 'Alur Persetujuan Pengadaan Barang BPR',
        description: 'Verifikasi pengajuan pengadaan oleh Kepala Bagian dan Approval Direksi Operasional',
        steps: {
          create: [
            {
              stepOrder: 1,
              name: 'Verifikasi Kepala Bagian / Dept Head',
              approverRoleId: adminRole.id,
              minAmount: 0,
              maxAmount: 10000000,
            },
            {
              stepOrder: 2,
              name: 'Persetujuan Direksi Operasional',
              approverRoleId: adminRole.id,
              minAmount: 10000000,
            }
          ]
        }
      }
    })

    // Seed sample Purchase Request (PR)
    const pr1 = await prisma.purchaseRequest.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        requestNumber: 'PR-2026-0001',
        requesterId: adminUser.id,
        title: 'Pengadaan Blanko & Kertas Formulir Akad Kredit Triwulan II',
        purpose: 'Kebutuhan pencetakan berkas permohonan kredit nasabah dan buku tabungan baru',
        requiredDate: new Date('2026-04-15'),
        status: 'APPROVED',
        totalEstimatedAmount: 4250000,
        notes: 'Penyedia langganan CV Bali Grafika Offset',
        items: {
          create: [
            {
              itemName: 'Kertas HVS A4 80gr PaperOne',
              category: 'Formulir & Kertas',
              unit: 'Rim',
              quantity: 50,
              estimatedPrice: 58000,
              totalPrice: 2900000,
              itemType: 'INVENTORY',
            },
            {
              itemName: 'Buku Tabungan BPR Adiartha Cetak Eksklusif',
              category: 'Formulir & Kertas',
              unit: 'Pcs',
              quantity: 90,
              estimatedPrice: 15000,
              totalPrice: 1350000,
              itemType: 'INVENTORY',
            }
          ]
        },
        workflowInstances: {
          create: {
            workflowId: workflow.id,
            entityType: 'PURCHASE_REQUEST',
            entityId: 'PR-2026-0001',
            currentStep: 2,
            status: 'APPROVED',
            actions: {
              create: [
                {
                  stepNumber: 1,
                  actorId: adminUser.id,
                  action: 'SUBMIT',
                  comment: 'Pengajuan pengadaan kertas triwulan II diajukan',
                },
                {
                  stepNumber: 2,
                  actorId: adminUser.id,
                  action: 'APPROVE',
                  comment: 'Disetujui. Silakan terbitkan Purchase Order ke CV Bali Grafika.',
                }
              ]
            }
          }
        }
      }
    })

    // Seed Purchase Order (PO)
    const po1 = await prisma.purchaseOrder.create({
      data: {
        organizationId: org.id,
        branchId: branch?.id,
        vendorId: v2.id,
        purchaseRequestId: pr1.id,
        poNumber: 'PO-2026-0001',
        poDate: new Date('2026-04-02'),
        expectedDeliveryDate: new Date('2026-04-10'),
        paymentTerms: 'NET 14 Hari',
        status: 'ISSUED',
        subtotal: 4250000,
        taxAmount: 467500, // PPN 11%
        totalAmount: 4717500,
        notes: 'Pengiriman ke Kantor Pusat BPR Lt. 1 Bagian Umum',
        createdById: adminUser.id,
        items: {
          create: [
            {
              itemName: 'Kertas HVS A4 80gr PaperOne',
              unit: 'Rim',
              quantityOrdered: 50,
              quantityReceived: 0,
              unitPrice: 58000,
              totalPrice: 2900000,
              itemType: 'INVENTORY',
            },
            {
              itemName: 'Buku Tabungan BPR Adiartha Cetak Eksklusif',
              unit: 'Pcs',
              quantityOrdered: 90,
              quantityReceived: 0,
              unitPrice: 15000,
              totalPrice: 1350000,
              itemType: 'INVENTORY',
            }
          ]
        }
      }
    })

    console.log('Sample purchasing data seeded successfully.')
  }

  // Seed sample Audit Logs (Section 22)
  const existingAudit = await prisma.auditLog.count({ where: { organizationId: org.id } })
  if (existingAudit === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          organizationId: org.id,
          userId: adminUser.id,
          action: 'LOGIN',
          entityType: 'USER',
          entityId: adminUser.id,
          ipAddress: '192.168.1.10',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
          notes: 'Autentikasi sesi berhasil untuk Administrator',
          createdAt: new Date('2026-03-30T08:00:00Z'),
        },
        {
          organizationId: org.id,
          userId: adminUser.id,
          action: 'CREATE',
          entityType: 'CREDIT_APPLICATION',
          entityId: 'APP-2026-0001',
          newValues: {
            applicationNumber: 'APP-2026-0001',
            requestedAmount: 50000000,
            product: 'Kredit Modal Kerja',
            applicant: 'Budi Santoso',
          },
          ipAddress: '192.168.1.10',
          notes: 'Pendaftaran permohonan kredit baru',
          createdAt: new Date('2026-03-30T08:15:00Z'),
        },
        {
          organizationId: org.id,
          userId: adminUser.id,
          action: 'APPROVE',
          entityType: 'CREDIT_APPLICATION',
          entityId: 'APP-2026-0001',
          oldValues: { status: 'REVIEW', approvedAmount: null },
          newValues: { status: 'APPROVED', approvedAmount: 50000000, approvedTenorMonths: 24 },
          ipAddress: '192.168.1.10',
          notes: 'Komite menyetujui plafond pinjaman Rp 50.000.000,-',
          createdAt: new Date('2026-03-30T09:30:00Z'),
        },
        {
          organizationId: org.id,
          userId: adminUser.id,
          action: 'ASSIGN',
          entityType: 'ASSET',
          entityId: 'AST-IT-2026-001',
          oldValues: { status: 'PURCHASED', currentHolderId: null },
          newValues: { status: 'ASSIGNED', currentHolderId: adminUser.id, location: 'Ruang Analis Lt. 2' },
          ipAddress: '192.168.1.10',
          notes: 'Serah terima unit laptop ThinkPad operasional',
          createdAt: new Date('2026-03-30T10:00:00Z'),
        },
        {
          organizationId: org.id,
          userId: adminUser.id,
          action: 'APPROVE',
          entityType: 'PURCHASE_REQUEST',
          entityId: 'PR-2026-0001',
          oldValues: { status: 'SUBMITTED' },
          newValues: { status: 'APPROVED' },
          ipAddress: '192.168.1.10',
          notes: 'Persetujuan pengadaan formulir dan buku tabungan triwulan II',
          createdAt: new Date('2026-03-30T10:45:00Z'),
        },
      ],
    })
    console.log('Sample audit logs seeded successfully.')
  }

  // Seed CMS Banners
  const existingBanners = await prisma.cmsBanner.count({ where: { organizationId: org.id } })
  if (existingBanners === 0) {
    await prisma.cmsBanner.createMany({
      data: [
        {
          organizationId: org.id,
          title: 'Solusi Finansial Terpercaya untuk Usaha Anda',
          subtitle: 'Kredit Modal Kerja dan Investasi dengan bunga kompetitif, plafon hingga Rp 1 Milyar, dan proses cepat.',
          imageUrl: '/hero-banner-1.jpg',
          ctaText: 'Ajukan Sekarang',
          ctaLink: '#form-pengajuan',
          isActive: true,
          sortOrder: 1,
        },
        {
          organizationId: org.id,
          title: 'Bunga Deposito Spesial 6.25% p.a.',
          subtitle: 'Simpanan berjangka aman berizin OJK, dijamin Lembaga Penjamin Simpanan (LPS) hingga Rp 2 Milyar.',
          imageUrl: '/hero-banner-2.jpg',
          ctaText: 'Simulasi Pinjaman',
          ctaLink: '#simulasi-kredit',
          isActive: true,
          sortOrder: 2,
        },
      ],
    })
    console.log('CMS Banners seeded.')
  }

  // Seed CMS Posts (News & Promos)
  const existingPosts = await prisma.cmsPost.count({ where: { organizationId: org.id } })
  if (existingPosts === 0) {
    await prisma.cmsPost.createMany({
      data: [
        {
          organizationId: org.id,
          title: 'BPR Adiartha Luncurkan Program Akselerasi UMKM Bali 2026',
          slug: 'bpr-adiartha-akselerasi-umkm-bali-2026',
          category: 'BERITA',
          excerpt: 'Mendukung pertumbuhan pelaku usaha lokal dengan fasilitas pendampingan usaha dan restrukturisasi modal produktif.',
          content: 'BPR Adiartha secara resmi mengumumkan komitmen penyaluran kredit produktif bagi lebih dari 500 pelaku UMKM di kawasan Denpasar dan Badung. Program ini menggabungkan kemudahan akses pembiayaan dengan bimbingan pencatatan keuangan digital.',
          status: 'PUBLISHED',
          publishedAt: new Date('2026-03-15T09:00:00Z'),
          authorName: 'Humas BPR Adiartha',
        },
        {
          organizationId: org.id,
          title: 'Promo Spesial Bunga Ringan 0.99% Per Bulan Semester Pertama',
          slug: 'promo-bunga-ringan-semester-pertama',
          category: 'PROMO',
          excerpt: 'Dapatkan suku bunga preferensial untuk pengajuan kredit modal kerja dengan agunan sertifikat tanah atau BPKB kendaraan.',
          content: 'Dalam rangka perayaan hari jadi BPR Adiartha, nikmati tarif suku bunga khusus mulai 0.99% flat per bulan untuk pengajuan kredit baru dengan tenor fleksibel hingga 36 bulan. Promo berlaku hingga akhir kuartal ini.',
          status: 'PUBLISHED',
          publishedAt: new Date('2026-03-20T10:00:00Z'),
          authorName: 'Tim Pemasaran',
        },
        {
          organizationId: org.id,
          title: 'Tips Cerdas Mengelola Arus Kas Usaha Mikro di Era Modern',
          slug: 'tips-cerdas-kelola-arus-kas-mikro',
          category: 'EDUKASI',
          excerpt: 'Langkah taktis memisahkan rekening pribadi dan usaha demi kelancaran likuiditas bisnis harian Anda.',
          content: 'Manajemen arus kas (cash flow) yang disiplin adalah kunci ketahanan usaha mikro. Simak tips praktis cara mengontrol biaya operasional, menyiapkan dana darurat usaha, dan memilih fasilitas pinjaman yang tepat.',
          status: 'PUBLISHED',
          publishedAt: new Date('2026-03-25T11:00:00Z'),
          authorName: 'Analis Keuangan BPR',
        },
      ],
    })
    console.log('CMS Posts seeded.')
  }

  // Seed CMS FAQs
  const existingFaqs = await prisma.cmsFaq.count({ where: { organizationId: org.id } })
  if (existingFaqs === 0) {
    await prisma.cmsFaq.createMany({
      data: [
        {
          organizationId: org.id,
          category: 'KREDIT',
          question: 'Apa saja persyaratan pokok untuk mengajukan kredit usaha?',
          answer: 'Persyaratan umum mencakup KTP pemohon dan pasangan, Kartu Keluarga, NPWP, bukti legalitas usaha (NIB/Surat Keterangan Usaha), rekening koran/mutasi tabungan 3 bulan terakhir, serta dokumen jaminan (SHM/BPKB).',
          sortOrder: 1,
          isActive: true,
        },
        {
          organizationId: org.id,
          category: 'KREDIT',
          question: 'Berapa lama proses survei hingga pencairan kredit?',
          answer: 'Proses survei lapangan rata-rata dilakukan dalam 1x24 jam setelah berkas lengkap diverifikasi. Keputusan komite kredit dan akad pencairan memakan waktu sekitar 2-3 hari kerja.',
          sortOrder: 2,
          isActive: true,
        },
        {
          organizationId: org.id,
          category: 'TABUNGAN',
          question: 'Apakah simpanan deposito di BPR aman dan dijamin?',
          answer: 'Sangat aman. Seluruh produk simpanan tabungan dan deposito di BPR berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) serta dijamin penuh oleh Lembaga Penjamin Simpanan (LPS) sesuai ketentuan yang berlaku.',
          sortOrder: 3,
          isActive: true,
        },
        {
          organizationId: org.id,
          category: 'UMUM',
          question: 'Bagaimana nasabah dapat membayarkan angsuran pinjaman bulanan?',
          answer: 'Nasabah dapat membayar angsuran langsung di counter teller seluruh kantor cabang BPR Adiartha, autodebet rekening tabungan BPR, maupun transfer antarbank melalui Virtual Account mitra kami.',
          sortOrder: 4,
          isActive: true,
        },
      ],
    })
    console.log('CMS FAQs seeded.')
  }

  // Seed Notifications
  const existingNotifs = await prisma.notification.count({ where: { organizationId: org.id } })
  if (existingNotifs === 0) {
    await prisma.notification.createMany({
      data: [
        {
          organizationId: org.id,
          userId: adminUser.id,
          title: 'Pengajuan Kredit Baru Menunggu Verifikasi',
          message: 'Permohonan kredit dari Budi Santoso (Rp 50.000.000) telah diterima dan siap diverifikasi.',
          type: 'APPROVAL_REQUEST',
          linkUrl: '/credit/applications',
          isRead: false,
          createdAt: new Date(),
        },
        {
          organizationId: org.id,
          userId: adminUser.id,
          title: 'Persetujuan Pengadaan Barang (PR-2026-0001)',
          message: 'Pengajuan pengadaan perlengkapan kantor triwulan II disetujui komite.',
          type: 'SUCCESS',
          linkUrl: '/purchasing/requests',
          isRead: false,
          createdAt: new Date(Date.now() - 3600000),
        },
        {
          organizationId: org.id,
          userId: adminUser.id,
          title: 'Pengingat Servis Rutin Aset Kantor',
          message: 'Laptop Dell Latitude AST-IT-2026-002 dijadwalkan inspeksi pemeliharaan bulan ini.',
          type: 'WARNING',
          linkUrl: '/inventory/assets',
          isRead: true,
          readAt: new Date(),
          createdAt: new Date(Date.now() - 86400000),
        },
      ],
    })
    console.log('Notifications seeded.')
  }

  // Seed Centralized Master Data
  const existingMaster = await prisma.masterItem.count({ where: { organizationId: org.id } })
  if (existingMaster === 0) {
    await prisma.masterItem.createMany({
      data: [
        // LOAN_PRODUCT
        {
          organizationId: org.id,
          category: 'LOAN_PRODUCT',
          code: 'KREDIT-MK',
          name: 'Kredit Modal Kerja',
          description: 'Fasilitas pinjaman perputaran modal usaha, pengadaan bahan baku, dan kas operasional bisnis.',
          attributes: { interestRate: 1.25, minAmount: 10000000, maxAmount: 500000000, minTenor: 6, maxTenor: 36 },
          sortOrder: 1,
          isActive: true,
        },
        {
          organizationId: org.id,
          category: 'LOAN_PRODUCT',
          code: 'KREDIT-INV',
          name: 'Kredit Investasi',
          description: 'Pinjaman jangka menengah-panjang untuk pembelian mesin, renovasi tempat usaha, atau kendaraan operasional.',
          attributes: { interestRate: 1.15, minAmount: 50000000, maxAmount: 1000000000, minTenor: 12, maxTenor: 60 },
          sortOrder: 2,
          isActive: true,
        },
        {
          organizationId: org.id,
          category: 'LOAN_PRODUCT',
          code: 'KREDIT-KNS',
          name: 'Kredit Multiguna & Konsumtif',
          description: 'Solusi dana tunai untuk kebutuhan renovasi rumah, pendidikan keluarga, dan keperluan mendesak.',
          attributes: { interestRate: 1.50, minAmount: 5000000, maxAmount: 200000000, minTenor: 6, maxTenor: 48 },
          sortOrder: 3,
          isActive: true,
        },
        // LEAD_SOURCE
        { organizationId: org.id, category: 'LEAD_SOURCE', code: 'SRC-WEB', name: 'Website Resmi BPR', sortOrder: 1, isActive: true },
        { organizationId: org.id, category: 'LEAD_SOURCE', code: 'SRC-MKT', name: 'Direct Field Marketing', sortOrder: 2, isActive: true },
        { organizationId: org.id, category: 'LEAD_SOURCE', code: 'SRC-REF', name: 'Referral Nasabah Setia', sortOrder: 3, isActive: true },
        { organizationId: org.id, category: 'LEAD_SOURCE', code: 'SRC-WALK', name: 'Walk-in Kantor Cabang', sortOrder: 4, isActive: true },
        { organizationId: org.id, category: 'LEAD_SOURCE', code: 'SRC-WA', name: 'WhatsApp Hotline Resmi', sortOrder: 5, isActive: true },
        // ASSET_CATEGORY
        { organizationId: org.id, category: 'ASSET_CATEGORY', code: 'AST-IT', name: 'IT Equipment & Komputer', sortOrder: 1, isActive: true },
        { organizationId: org.id, category: 'ASSET_CATEGORY', code: 'AST-FURN', name: 'Office Furniture & Meja Kursi', sortOrder: 2, isActive: true },
        { organizationId: org.id, category: 'ASSET_CATEGORY', code: 'AST-VEH', name: 'Kendaraan Dinas Lapangan', sortOrder: 3, isActive: true },
        { organizationId: org.id, category: 'ASSET_CATEGORY', code: 'AST-ELEC', name: 'Peralatan Elektronik & AC', sortOrder: 4, isActive: true },
        // INVENTORY_CATEGORY
        { organizationId: org.id, category: 'INVENTORY_CATEGORY', code: 'INV-ATK', name: 'Alat Tulis Kantor (ATK)', sortOrder: 1, isActive: true },
        { organizationId: org.id, category: 'INVENTORY_CATEGORY', code: 'INV-PRINT', name: 'Formulir, Kertas & Buku Tabungan', sortOrder: 2, isActive: true },
        { organizationId: org.id, category: 'INVENTORY_CATEGORY', code: 'INV-TONER', name: 'Toner & Cartridge Printer', sortOrder: 3, isActive: true },
        { organizationId: org.id, category: 'INVENTORY_CATEGORY', code: 'INV-CLEAN', name: 'Perlengkapan Kebersihan Gedung', sortOrder: 4, isActive: true },
        // DOCUMENT_TYPE
        { organizationId: org.id, category: 'DOCUMENT_TYPE', code: 'DOC-KTP', name: 'KTP Pemohon & Pasangan', sortOrder: 1, isActive: true },
        { organizationId: org.id, category: 'DOCUMENT_TYPE', code: 'DOC-KK', name: 'Kartu Keluarga (KK)', sortOrder: 2, isActive: true },
        { organizationId: org.id, category: 'DOCUMENT_TYPE', code: 'DOC-NPWP', name: 'Nomor Pokok Wajib Pajak (NPWP)', sortOrder: 3, isActive: true },
        { organizationId: org.id, category: 'DOCUMENT_TYPE', code: 'DOC-SLIP', name: 'Slip Gaji / Rekening Koran 3 Bulan', sortOrder: 4, isActive: true },
        { organizationId: org.id, category: 'DOCUMENT_TYPE', code: 'DOC-SIUP', name: 'Legalitas Usaha (NIB / SKU)', sortOrder: 5, isActive: true },
        { organizationId: org.id, category: 'DOCUMENT_TYPE', code: 'DOC-COLL', name: 'Bukti Kepemilikan Agunan (SHM / BPKB)', sortOrder: 6, isActive: true },
        // VENDOR_CATEGORY
        { organizationId: org.id, category: 'VENDOR_CATEGORY', code: 'VND-ATK', name: 'Percetakan & Suplai ATK', sortOrder: 1, isActive: true },
        { organizationId: org.id, category: 'VENDOR_CATEGORY', code: 'VND-IT', name: 'Penyedia IT, Komputer & Jaringan', sortOrder: 2, isActive: true },
        { organizationId: org.id, category: 'VENDOR_CATEGORY', code: 'VND-BLD', name: 'Pemeliharaan Gedung & Fasilitas', sortOrder: 3, isActive: true },
        // POSITION
        { organizationId: org.id, category: 'POSITION', code: 'POS-AO', name: 'Account Officer (Marketing)', sortOrder: 1, isActive: true },
        { organizationId: org.id, category: 'POSITION', code: 'POS-CA', name: 'Credit Analyst', sortOrder: 2, isActive: true },
        { organizationId: org.id, category: 'POSITION', code: 'POS-FO', name: 'Field Officer (Surveyor)', sortOrder: 3, isActive: true },
        { organizationId: org.id, category: 'POSITION', code: 'POS-BM', name: 'Branch Manager', sortOrder: 4, isActive: true },
        { organizationId: org.id, category: 'POSITION', code: 'POS-DIR', name: 'Direktur Operasional', sortOrder: 5, isActive: true },
      ],
    })
    console.log('Master Items seeded.')
  }

  // =====================================================================
  // RBAC: Permission catalog + roles + role-permission matrix
  // (sesuai docs/ROLE_PERMISSION_MATRIX.md)
  // =====================================================================
  const PERMISSION_CATALOG: string[] = [
    "dashboard.view", "dashboard.management_view",
    "crm.lead.view", "crm.lead.create", "crm.lead.update", "crm.lead.delete", "crm.lead.assign",
    "crm.customer.view", "crm.customer.create", "crm.customer.update",
    "credit.application.view", "credit.application.create", "credit.application.update",
    "credit.application.delete", "credit.application.submit", "credit.application.assign",
    "credit.application.verify", "credit.application.return", "credit.application.export",
    "credit.analysis.view", "credit.analysis.create", "credit.analysis.update",
    "credit.analysis.submit", "credit.analysis.return",
    "credit.survey.view", "credit.survey.create", "credit.survey.update",
    "credit.survey.assign", "credit.survey.submit",
    "credit.review.view", "credit.review.create", "credit.review.update",
    "credit.review.submit", "credit.review.return",
    "credit.decision.view", "credit.decision.approve", "credit.decision.reject", "credit.decision.return",
    "credit.realization.view", "credit.realization.create", "credit.realization.update",
    "credit.realization.confirm", "credit.realization.export",
    "field.task.view", "field.task.create", "field.task.assign", "field.task.update",
    "field.activity.view", "field.activity.create", "field.activity.update",
    "field.performance.view",
    "document.view", "document.upload", "document.update", "document.delete",
    "document.download", "document.manage_types",
    "inventory.item.view", "inventory.item.create", "inventory.item.update",
    "inventory.stock_in", "inventory.stock_out", "inventory.adjust", "inventory.export",
    "asset.view", "asset.create", "asset.update", "asset.assign", "asset.transfer",
    "asset.maintenance", "asset.dispose", "asset.export",
    "purchase.request.view", "purchase.request.create", "purchase.request.update",
    "purchase.request.submit", "purchase.request.approve", "purchase.request.reject",
    "purchase.order.view", "purchase.order.create", "purchase.order.update", "purchase.order.approve",
    "purchase.receipt.view", "purchase.receipt.create",
    "vendor.view", "vendor.create", "vendor.update",
    "report.credit.view", "report.credit.export", "report.field.view", "report.field.export",
    "report.inventory.view", "report.inventory.export", "report.purchasing.view", "report.purchasing.export",
    "report.management.view", "report.management.export",
    "cms.page.view", "cms.page.create", "cms.page.update", "cms.page.publish", "cms.page.delete",
    "cms.post.view", "cms.post.create", "cms.post.update", "cms.post.publish", "cms.post.delete",
    "cms.banner.manage", "cms.faq.manage", "cms.media.manage",
    "admin.user.view", "admin.user.create", "admin.user.update", "admin.user.disable",
    "admin.role.view", "admin.role.create", "admin.role.update", "admin.permission.view",
    "admin.master_data.view", "admin.master_data.manage",
    "admin.workflow.view", "admin.workflow.manage",
    "admin.settings.view", "admin.settings.manage",
    "audit.log.view", "audit.log.export",
  ]

  for (const code of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: code },
    })
  }
  console.log("Permission catalog seeded:", PERMISSION_CATALOG.length, "permissions")

  const allPermIds = async () =>
    (await prisma.permission.findMany({ select: { id: true } })).map((p) => p.id)

  const viewOf = (domain: string, actions = ["view"]) =>
    actions.map((a) => `${domain}.${a}`)

  const ROLE_MATRIX: Array<{ code: string; name: string; description: string; permissions: string[] }> = [
    {
      code: "ADMIN_OPERASIONAL", name: "Admin Operasional",
      description: "Administrasi operasional pada organisasi yang ditugaskan",
      permissions: [
        "dashboard.view", ...viewOf("crm.lead", ["view", "create", "update", "delete", "assign"]),
        ...viewOf("crm.customer", ["view", "create", "update"]),
        "credit.application.view", "credit.application.update", "credit.application.assign", "credit.application.verify",
        "credit.analysis.view", "credit.survey.view", "credit.review.view", "credit.decision.view",
        "credit.realization.view", "credit.realization.create", "credit.realization.update",
        ...viewOf("field.task", ["view"]), "field.performance.view",
        "document.view", "document.upload", "document.update", "document.delete",
        ...viewOf("inventory.item", ["view", "create", "update"]), "inventory.stock_in", "inventory.stock_out", "inventory.adjust", "inventory.export",
        ...viewOf("asset", ["view", "create", "update", "assign", "transfer", "maintenance", "dispose", "export"]),
        ...viewOf("purchase.request", ["view", "create", "update", "submit"]),
        ...viewOf("purchase.order", ["view", "create", "update"]),
        ...viewOf("purchase.receipt", ["view", "create"]),
        ...viewOf("vendor", ["view", "create", "update"]),
        ...viewOf("report", ["credit", "field", "inventory", "purchasing", "management"].flatMap((d) => [`${d}.view`, `${d}.export`])),
        "cms.post.view",
        "admin.user.view", "admin.user.create", "admin.user.update", "admin.user.disable",
        "admin.role.view", "admin.master_data.view", "admin.master_data.manage",
        "admin.workflow.view", "audit.log.view",
      ].filter(Boolean),
    },
    {
      code: "MARKETING", name: "Marketing / Account Officer",
      description: "Leads dan pengajuan kredit pada cabang/portfolio yang ditugaskan",
      permissions: [
        "dashboard.view",
        ...viewOf("crm.lead", ["view", "create", "update", "assign"]),
        "crm.customer.view", "crm.customer.create", "crm.customer.update",
        "credit.application.view", "credit.application.create", "credit.application.update", "credit.application.submit",
        "credit.survey.view", "field.task.view", "field.activity.view", "field.activity.create", "field.performance.view",
        "document.view", "document.upload", "document.update",
        "report.credit.view", "report.field.view",
      ],
    },
    {
      code: "FIELD_OFFICER", name: "Field Officer / Surveyor",
      description: "Survey dan aktivitas lapangan pada tugas yang ditugaskan",
      permissions: [
        "dashboard.view", "crm.lead.view", "credit.application.view", "credit.application.update",
        ...viewOf("credit.survey", ["view", "create", "update", "submit"]),
        "field.task.view", "field.task.update", "field.activity.view", "field.activity.create", "field.activity.update",
        "document.view", "document.upload", "document.update", "report.field.view",
      ],
    },
    {
      code: "CREDIT_ANALYST", name: "Analis Kredit",
      description: "Analisis kelayakan kredit",
      permissions: [
        "dashboard.view", "crm.lead.view", "crm.customer.view",
        "credit.application.view", "credit.application.verify",
        ...viewOf("credit.analysis", ["view", "create", "update", "submit", "return"]),
        "credit.survey.view", "credit.review.view", "credit.decision.view",
        "field.task.view", "field.activity.view",
        "document.view", "document.update", "report.credit.view",
      ],
    },
    {
      code: "CREDIT_REVIEWER", name: "Reviewer Kredit",
      description: "Review dan rekomendasi kredit",
      permissions: [
        "dashboard.view", "crm.customer.view",
        "credit.application.view", "credit.analysis.view", "credit.survey.view",
        ...viewOf("credit.review", ["view", "create", "update", "submit", "return"]),
        "credit.decision.view", "credit.decision.return",
        "credit.realization.view", "field.task.view",
        "document.view", "document.update", "report.credit.view",
      ],
    },
    {
      code: "APPROVER", name: "Approver / Pejabat Persetujuan",
      description: "Persetujuan kredit sesuai otoritas (limit approval)",
      permissions: [
        "dashboard.view", "crm.customer.view",
        "credit.application.view", "credit.analysis.view", "credit.survey.view", "credit.review.view",
        "credit.decision.view", "credit.decision.approve", "credit.decision.reject", "credit.decision.return",
        ...viewOf("credit.realization", ["view", "confirm"]),
        "inventory.item.view", "asset.view",
        "purchase.request.view", "purchase.request.approve", "purchase.request.reject", "purchase.order.view",
        "document.view", "document.download",
        ...viewOf("report", ["credit", "field", "inventory", "purchasing", "management"].map((d) => `${d}.view`)),
      ],
    },
    {
      code: "PURCHASING_OFFICER", name: "Petugas Pengadaan",
      description: "Purchasing pada organisasi yang ditugaskan",
      permissions: [
        "dashboard.view",
        ...viewOf("purchase.request", ["view", "create", "update", "submit"]),
        ...viewOf("purchase.order", ["view", "create", "update"]),
        ...viewOf("purchase.receipt", ["view", "create"]),
        ...viewOf("vendor", ["view", "create", "update"]),
        "inventory.item.view", "asset.view",
        ...viewOf("report", ["inventory", "purchasing"].map((d) => `${d}.view`)),
      ],
    },
    {
      code: "ASSET_OFFICER", name: "Petugas Aset & Inventaris",
      description: "Aset dan inventaris pada organisasi yang ditugaskan",
      permissions: [
        "dashboard.view",
        ...viewOf("inventory.item", ["view", "create", "update"]),
        "inventory.stock_in", "inventory.stock_out", "inventory.adjust", "inventory.export",
        ...viewOf("asset", ["view", "create", "update", "assign", "transfer", "maintenance", "dispose", "export"]),
        "purchase.receipt.view", "vendor.view",
        ...viewOf("report", ["inventory", "purchasing"].map((d) => `${d}.view`)),
      ],
    },
    {
      code: "FINANCE", name: "Keuangan",
      description: "Catatan keuangan purchasing/operasional",
      permissions: [
        "dashboard.view",
        "credit.realization.view",
        "inventory.item.view", "asset.view",
        ...viewOf("purchase.request", ["view"]), ...viewOf("purchase.order", ["view"]),
        ...viewOf("purchase.receipt", ["view", "create"]), "vendor.view",
        ...viewOf("report", ["inventory", "purchasing", "management"].map((d) => `${d}.view`)),
      ],
    },
    {
      code: "MANAGEMENT", name: "Manajemen",
      description: "Dashboard dan laporan manajemen",
      permissions: [
        "dashboard.view", "dashboard.management_view",
        "crm.lead.view", "crm.customer.view",
        "credit.application.view", "credit.analysis.view", "credit.survey.view",
        "credit.review.view", "credit.decision.view", "credit.realization.view",
        "field.task.view", "field.performance.view",
        "document.view",
        "inventory.item.view", "asset.view",
        ...viewOf("purchase.request", ["view"]), ...viewOf("purchase.order", ["view"]),
        ...viewOf("purchase.receipt", ["view"]), "vendor.view",
        ...viewOf("report", ["credit", "field", "inventory", "purchasing", "management"].flatMap((d) => [`${d}.view`, `${d}.export`])),
        "cms.post.view",
        "admin.user.view", "audit.log.view",
      ],
    },
    {
      code: "AUDITOR", name: "Auditor",
      description: "Investigasi read-only",
      permissions: [
        "dashboard.view",
        "crm.lead.view", "crm.customer.view",
        "credit.application.view", "credit.analysis.view", "credit.survey.view",
        "credit.review.view", "credit.decision.view", "credit.realization.view",
        "field.task.view", "field.performance.view",
        "document.view", "document.download",
        "inventory.item.view", "asset.view",
        ...viewOf("purchase.request", ["view"]), ...viewOf("purchase.order", ["view"]),
        ...viewOf("purchase.receipt", ["view"]), "vendor.view",
        ...viewOf("report", ["credit", "field", "inventory", "purchasing", "management"].flatMap((d) => [`${d}.view`, `${d}.export`])),
        "audit.log.view", "audit.log.export",
      ],
    },
    {
      code: "CMS_EDITOR", name: "Editor Website",
      description: "Konten website publik (CMS saja)",
      permissions: [
        "cms.page.view", "cms.page.create", "cms.page.update", "cms.page.publish", "cms.page.delete",
        "cms.post.view", "cms.post.create", "cms.post.update", "cms.post.publish", "cms.post.delete",
        "cms.banner.manage", "cms.faq.manage", "cms.media.manage",
      ],
    },
    {
      code: "VIEWER", name: "Viewer",
      description: "Akses baca saja pada scope yang ditugaskan",
      permissions: [
        "dashboard.view", "crm.lead.view", "crm.customer.view",
        "credit.application.view", "document.view", "inventory.item.view", "asset.view",
        "purchase.request.view", "purchase.order.view", "purchase.receipt.view", "vendor.view",
      ],
    },
  ]

  for (const r of ROLE_MATRIX) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: { code: r.code, name: r.name, description: r.description },
    })
    const perms = await prisma.permission.findMany({
      where: { code: { in: r.permissions } },
      select: { id: true },
    })
    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      })
    }
  }
  console.log("RBAC roles seeded:", ROLE_MATRIX.length, "roles")

  // SUPER_ADMIN (ADMIN code) mendapat seluruh permission + admin.super wildcard
  const superAdmin = await prisma.role.upsert({
    where: { code: "ADMIN" },
    update: { name: "Super Admin" },
    create: { code: "ADMIN", name: "Super Admin", isSystem: true },
  })
  await prisma.permission.upsert({
    where: { code: "admin.super" },
    update: {},
    create: { code: "admin.super", name: "admin.super" },
  })
  const allPerms = await allPermIds()
  const superPerm = await prisma.permission.findUnique({ where: { code: "admin.super" } })
  for (const pid of [...allPerms, superPerm!.id]) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: pid } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: pid },
    })
  }
  console.log("Super Admin granted all permissions")

  console.log('Seeding completed. Admin user created:', adminUser.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
