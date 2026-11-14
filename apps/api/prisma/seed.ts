import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// Course data
// ─────────────────────────────────────────────
const COURSES = [
  {
    name: "Pebble Beach Golf Links",
    city: "Pebble Beach", state: "CA", country: "USA",
    par: 72, numHoles: 18, rating: 75.5, slope: 145, isPublic: true,
    holes: [
      { holeNumber: 1,  par: 4, yardage: 381, handicapRank: 8  },
      { holeNumber: 2,  par: 5, yardage: 516, handicapRank: 12 },
      { holeNumber: 3,  par: 4, yardage: 404, handicapRank: 14 },
      { holeNumber: 4,  par: 4, yardage: 331, handicapRank: 16 },
      { holeNumber: 5,  par: 3, yardage: 195, handicapRank: 10 },
      { holeNumber: 6,  par: 5, yardage: 523, handicapRank: 2  },
      { holeNumber: 7,  par: 3, yardage: 106, handicapRank: 18 },
      { holeNumber: 8,  par: 4, yardage: 428, handicapRank: 4  },
      { holeNumber: 9,  par: 4, yardage: 505, handicapRank: 6  },
      { holeNumber: 10, par: 4, yardage: 495, handicapRank: 1  },
      { holeNumber: 11, par: 4, yardage: 390, handicapRank: 11 },
      { holeNumber: 12, par: 3, yardage: 202, handicapRank: 15 },
      { holeNumber: 13, par: 4, yardage: 445, handicapRank: 5  },
      { holeNumber: 14, par: 5, yardage: 580, handicapRank: 3  },
      { holeNumber: 15, par: 4, yardage: 396, handicapRank: 13 },
      { holeNumber: 16, par: 4, yardage: 402, handicapRank: 9  },
      { holeNumber: 17, par: 3, yardage: 178, handicapRank: 17 },
      { holeNumber: 18, par: 5, yardage: 543, handicapRank: 7  },
    ],
  },
  {
    name: "TPC Sawgrass (Stadium)",
    city: "Ponte Vedra Beach", state: "FL", country: "USA",
    par: 72, numHoles: 18, rating: 76.4, slope: 155, isPublic: true,
    holes: [
      { holeNumber: 1,  par: 4, yardage: 423, handicapRank: 10 },
      { holeNumber: 2,  par: 5, yardage: 532, handicapRank: 8  },
      { holeNumber: 3,  par: 3, yardage: 177, handicapRank: 16 },
      { holeNumber: 4,  par: 4, yardage: 384, handicapRank: 12 },
      { holeNumber: 5,  par: 4, yardage: 466, handicapRank: 2  },
      { holeNumber: 6,  par: 4, yardage: 393, handicapRank: 14 },
      { holeNumber: 7,  par: 4, yardage: 442, handicapRank: 4  },
      { holeNumber: 8,  par: 3, yardage: 237, handicapRank: 18 },
      { holeNumber: 9,  par: 5, yardage: 583, handicapRank: 6  },
      { holeNumber: 10, par: 4, yardage: 424, handicapRank: 7  },
      { holeNumber: 11, par: 5, yardage: 558, handicapRank: 5  },
      { holeNumber: 12, par: 4, yardage: 358, handicapRank: 15 },
      { holeNumber: 13, par: 3, yardage: 181, handicapRank: 17 },
      { holeNumber: 14, par: 4, yardage: 467, handicapRank: 1  },
      { holeNumber: 15, par: 4, yardage: 449, handicapRank: 3  },
      { holeNumber: 16, par: 5, yardage: 523, handicapRank: 9  },
      { holeNumber: 17, par: 3, yardage: 137, handicapRank: 13 },
      { holeNumber: 18, par: 4, yardage: 462, handicapRank: 11 },
    ],
  },
  {
    name: "Torrey Pines South",
    city: "La Jolla", state: "CA", country: "USA",
    par: 72, numHoles: 18, rating: 78.1, slope: 143, isPublic: true,
    holes: [
      { holeNumber: 1,  par: 4, yardage: 452, handicapRank: 8  },
      { holeNumber: 2,  par: 4, yardage: 389, handicapRank: 14 },
      { holeNumber: 3,  par: 3, yardage: 201, handicapRank: 18 },
      { holeNumber: 4,  par: 4, yardage: 453, handicapRank: 4  },
      { holeNumber: 5,  par: 4, yardage: 475, handicapRank: 2  },
      { holeNumber: 6,  par: 5, yardage: 515, handicapRank: 12 },
      { holeNumber: 7,  par: 4, yardage: 459, handicapRank: 6  },
      { holeNumber: 8,  par: 3, yardage: 178, handicapRank: 16 },
      { holeNumber: 9,  par: 5, yardage: 612, handicapRank: 10 },
      { holeNumber: 10, par: 4, yardage: 413, handicapRank: 11 },
      { holeNumber: 11, par: 3, yardage: 221, handicapRank: 17 },
      { holeNumber: 12, par: 4, yardage: 504, handicapRank: 1  },
      { holeNumber: 13, par: 5, yardage: 614, handicapRank: 7  },
      { holeNumber: 14, par: 4, yardage: 435, handicapRank: 9  },
      { holeNumber: 15, par: 4, yardage: 467, handicapRank: 3  },
      { holeNumber: 16, par: 3, yardage: 227, handicapRank: 15 },
      { holeNumber: 17, par: 4, yardage: 453, handicapRank: 5  },
      { holeNumber: 18, par: 5, yardage: 570, handicapRank: 13 },
    ],
  },
  {
    name: "Bethpage Black",
    city: "Farmingdale", state: "NY", country: "USA",
    par: 71, numHoles: 18, rating: 77.5, slope: 155, isPublic: true,
    holes: [
      { holeNumber: 1,  par: 4, yardage: 430, handicapRank: 10 },
      { holeNumber: 2,  par: 4, yardage: 389, handicapRank: 14 },
      { holeNumber: 3,  par: 3, yardage: 230, handicapRank: 16 },
      { holeNumber: 4,  par: 5, yardage: 517, handicapRank: 8  },
      { holeNumber: 5,  par: 4, yardage: 478, handicapRank: 2  },
      { holeNumber: 6,  par: 4, yardage: 408, handicapRank: 12 },
      { holeNumber: 7,  par: 4, yardage: 524, handicapRank: 4  },
      { holeNumber: 8,  par: 3, yardage: 210, handicapRank: 18 },
      { holeNumber: 9,  par: 4, yardage: 460, handicapRank: 6  },
      { holeNumber: 10, par: 4, yardage: 492, handicapRank: 1  },
      { holeNumber: 11, par: 4, yardage: 435, handicapRank: 9  },
      { holeNumber: 12, par: 4, yardage: 501, handicapRank: 3  },
      { holeNumber: 13, par: 5, yardage: 608, handicapRank: 5  },
      { holeNumber: 14, par: 3, yardage: 161, handicapRank: 17 },
      { holeNumber: 15, par: 4, yardage: 478, handicapRank: 7  },
      { holeNumber: 16, par: 4, yardage: 490, handicapRank: 11 },
      { holeNumber: 17, par: 3, yardage: 207, handicapRank: 15 },
      { holeNumber: 18, par: 4, yardage: 411, handicapRank: 13 },
    ],
  },
  {
    name: "Augusta National Golf Club",
    city: "Augusta", state: "GA", country: "USA",
    par: 72, numHoles: 18, rating: 76.2, slope: 148, isPublic: false,
    holes: [
      { holeNumber: 1,  par: 4, yardage: 445, handicapRank: 4  },
      { holeNumber: 2,  par: 5, yardage: 575, handicapRank: 13 },
      { holeNumber: 3,  par: 4, yardage: 350, handicapRank: 7  },
      { holeNumber: 4,  par: 3, yardage: 240, handicapRank: 16 },
      { holeNumber: 5,  par: 4, yardage: 495, handicapRank: 1  },
      { holeNumber: 6,  par: 3, yardage: 180, handicapRank: 18 },
      { holeNumber: 7,  par: 4, yardage: 450, handicapRank: 8  },
      { holeNumber: 8,  par: 5, yardage: 570, handicapRank: 5  },
      { holeNumber: 9,  par: 4, yardage: 460, handicapRank: 9  },
      { holeNumber: 10, par: 4, yardage: 495, handicapRank: 2  },
      { holeNumber: 11, par: 4, yardage: 520, handicapRank: 3  },
      { holeNumber: 12, par: 3, yardage: 155, handicapRank: 14 },
      { holeNumber: 13, par: 5, yardage: 510, handicapRank: 15 },
      { holeNumber: 14, par: 4, yardage: 440, handicapRank: 10 },
      { holeNumber: 15, par: 5, yardage: 550, handicapRank: 6  },
      { holeNumber: 16, par: 3, yardage: 170, handicapRank: 17 },
      { holeNumber: 17, par: 4, yardage: 440, handicapRank: 11 },
      { holeNumber: 18, par: 4, yardage: 465, handicapRank: 12 },
    ],
  },
  {
    name: "Pinehurst No. 2",
    city: "Pinehurst", state: "NC", country: "USA",
    par: 72, numHoles: 18, rating: 75.4, slope: 138, isPublic: true,
    holes: [
      { holeNumber: 1,  par: 4, yardage: 404, handicapRank: 9  },
      { holeNumber: 2,  par: 4, yardage: 454, handicapRank: 3  },
      { holeNumber: 3,  par: 4, yardage: 379, handicapRank: 13 },
      { holeNumber: 4,  par: 5, yardage: 565, handicapRank: 5  },
      { holeNumber: 5,  par: 4, yardage: 477, handicapRank: 1  },
      { holeNumber: 6,  par: 3, yardage: 222, handicapRank: 17 },
      { holeNumber: 7,  par: 4, yardage: 404, handicapRank: 11 },
      { holeNumber: 8,  par: 5, yardage: 588, handicapRank: 7  },
      { holeNumber: 9,  par: 3, yardage: 195, handicapRank: 15 },
      { holeNumber: 10, par: 5, yardage: 610, handicapRank: 6  },
      { holeNumber: 11, par: 4, yardage: 478, handicapRank: 2  },
      { holeNumber: 12, par: 4, yardage: 445, handicapRank: 4  },
      { holeNumber: 13, par: 4, yardage: 384, handicapRank: 12 },
      { holeNumber: 14, par: 4, yardage: 479, handicapRank: 8  },
      { holeNumber: 15, par: 3, yardage: 206, handicapRank: 16 },
      { holeNumber: 16, par: 5, yardage: 531, handicapRank: 10 },
      { holeNumber: 17, par: 3, yardage: 195, handicapRank: 18 },
      { holeNumber: 18, par: 4, yardage: 447, handicapRank: 14 },
    ],
  },
];

// ─────────────────────────────────────────────
// Dev users (local / staging only)
// ─────────────────────────────────────────────
const DEV_USERS = [
  {
    email:    "demo@golfnme.dev",
    name:     "Demo Golfer",
    username: "demo",
    password: "demo1234",
    handicap: 14.2,
  },
  {
    email:    "alice@golfnme.dev",
    name:     "Alice Green",
    username: "aliceg",
    password: "alice1234",
    handicap: 8.5,
  },
  {
    email:    "bob@golfnme.dev",
    name:     "Bob Fairway",
    username: "bobf",
    password: "bob12345",
    handicap: 22.0,
  },
];

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding database...\n");

  // Courses
  for (const courseData of COURSES) {
    const { holes, ...course } = courseData;

    const existing = await prisma.course.findFirst({ where: { name: course.name } });
    if (existing) {
      console.log(`  ⏭️  Course "${course.name}" already exists`);
      continue;
    }

    const created = await prisma.course.create({
      data: { ...course, holes: { create: holes } },
      include: { holes: true },
    });
    console.log(`  ✅ Course: ${created.name} (${created.holes.length} holes)`);
  }

  // Dev users — skip in production
  if (process.env.NODE_ENV === "production") {
    console.log("\n⚠️  Skipping dev user creation in production");
  } else {
    console.log("\n👤 Creating dev users...");
    for (const userData of DEV_USERS) {
      const existing = await prisma.user.findUnique({ where: { email: userData.email } });
      if (existing) {
        console.log(`  ⏭️  User "${userData.username}" already exists`);
        continue;
      }

      const passwordHash = await bcrypt.hash(userData.password, 12);
      const created = await prisma.user.create({
        data: {
          email:        userData.email,
          name:         userData.name,
          username:     userData.username,
          passwordHash,
          handicap:     userData.handicap,
        },
      });
      console.log(`  ✅ User: ${created.username} (${created.email})`);
    }
  }

  console.log("\n✨ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
