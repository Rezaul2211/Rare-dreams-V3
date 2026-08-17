import { collection, getDocs, doc, writeBatch, query, where, limit } from 'firebase/firestore';
import { db } from './firebase';

const DUMMY_PRODUCTS = [
  // Boys Item
  {
    id: 'prod-boys-1',
    name: 'Corduroy Jacket & Denim Set',
    category: 'Boys Item',
    price: 35,
    comparePrice: 50,
    discount: 30,
    stockQuantity: 45,
    sizeOptions: ['2Y', '4Y', '6Y', '8Y'],
    colorOptions: ['Mustard Yellow', 'Blue Denim'],
    material: '100% Premium Cotton & Corduroy',
    description: 'Stylish mustard corduroy jacket paired with soft durable denim jeans.',
    images: ['https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  {
    id: 'prod-boys-2',
    name: 'Boys Casual Polo Shirt',
    category: 'Boys Item',
    price: 22,
    comparePrice: 30,
    discount: 26,
    stockQuantity: 60,
    sizeOptions: ['2Y', '4Y', '6Y', '8Y'],
    colorOptions: ['Navy', 'White', 'Red'],
    material: 'Breathable Cotton Knit',
    description: 'Comfortable everyday casual polo shirt for boys.',
    images: ['https://images.unsplash.com/photo-1503945438517-f65904a52ce6?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  // Girls Item
  {
    id: 'prod-girls-1',
    name: 'White Floral Ruffle Dress',
    category: 'Girls Item',
    price: 38,
    comparePrice: 55,
    discount: 30,
    stockQuantity: 50,
    sizeOptions: ['2Y', '4Y', '6Y', '8Y'],
    colorOptions: ['Floral White', 'Rose Pink'],
    material: 'Ultra-Soft Organic Cotton',
    description: 'Charming floral printed summer dress with ruffle sleeves.',
    images: ['https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  {
    id: 'prod-girls-2',
    name: 'Princess Pleated Skirt Set',
    category: 'Girls Item',
    price: 29,
    comparePrice: 42,
    discount: 31,
    stockQuantity: 35,
    sizeOptions: ['2Y', '4Y', '6Y', '8Y'],
    colorOptions: ['Pastel Pink', 'Cream'],
    material: 'Soft Chiffon & Cotton',
    description: 'Delicate pleated skirt set for party and casual wear.',
    images: ['https://images.unsplash.com/photo-1621452773781-0f992fd1f5cb?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  // Baby Item
  {
    id: 'prod-baby-1',
    name: 'Organic Onesie & Grooming Kit',
    category: 'Baby Item',
    price: 28,
    comparePrice: 40,
    discount: 30,
    stockQuantity: 80,
    sizeOptions: ['0-3M', '3-6M', '6-12M'],
    colorOptions: ['Cream', 'Soft Blue', 'Soft Pink'],
    material: '100% Certified Organic Cotton',
    description: 'Ultra-gentle baby bodysuit with essential comb and feeding accessories.',
    images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  {
    id: 'prod-baby-2',
    name: 'Baby Sleeping Blanket Set',
    category: 'Baby Item',
    price: 24,
    comparePrice: 35,
    discount: 31,
    stockQuantity: 70,
    sizeOptions: ['Free Size'],
    colorOptions: ['Pastel Blue', 'Pastel Pink', 'Cream'],
    material: 'Super Soft Fleece & Cotton',
    description: 'Cozy and warm swaddle blanket set for newborn comfort.',
    images: ['https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  // Footwear Item
  {
    id: 'prod-footwear-1',
    name: 'Kids Velcro Cushion Sneakers',
    category: 'Footwear Item',
    price: 32,
    comparePrice: 48,
    discount: 33,
    stockQuantity: 65,
    sizeOptions: ['24', '26', '28', '30', '32'],
    colorOptions: ['White/Pink', 'White/Grey', 'All Black'],
    material: 'Breathable Mesh & Lightweight Rubber',
    description: 'Lightweight, slip-resistant velcro sneakers designed for active play.',
    images: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  {
    id: 'prod-footwear-2',
    name: 'Casual Slip-On Loafers',
    category: 'Footwear Item',
    price: 40,
    comparePrice: 60,
    discount: 33,
    stockQuantity: 40,
    sizeOptions: ['26', '28', '30', '32'],
    colorOptions: ['Brown Leather', 'Black'],
    material: 'Genuine Soft Leather',
    description: 'Flexible and supportive leather loafers for boys and girls.',
    images: ['https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  // Women
  {
    id: 'prod-women-1',
    name: 'Summer Flow Dress',
    category: 'Women',
    price: 141,
    comparePrice: 180,
    discount: 22,
    stockQuantity: 68,
    sizeOptions: ['S', 'M', 'L'],
    colorOptions: ['Black', 'White', 'Blue'],
    material: 'Premium Material',
    description: 'This is a premium summer flow dress for Women.',
    images: ['https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  {
    id: 'prod-women-2',
    name: 'Silk Blouse',
    category: 'Women',
    price: 147,
    comparePrice: 197,
    discount: 25,
    stockQuantity: 83,
    sizeOptions: ['S', 'M', 'L'],
    colorOptions: ['Black', 'White', 'Blue'],
    material: 'Premium Material',
    description: 'This is a premium silk blouse for Women.',
    images: ['https://images.unsplash.com/photo-1434389672724-4fa9d120c153?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  // Men
  {
    id: 'prod-men-1',
    name: 'Classic Suit Jacket',
    category: 'Men',
    price: 89,
    comparePrice: 120,
    discount: 25,
    stockQuantity: 96,
    sizeOptions: ['S', 'M', 'L', 'XL'],
    colorOptions: ['Black', 'Navy Blue', 'Grey'],
    material: 'Premium Material',
    description: 'This is a premium classic suit jacket for Men.',
    images: ['https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  },
  {
    id: 'prod-men-2',
    name: 'Cotton Polo T-Shirt',
    category: 'Men',
    price: 35,
    comparePrice: 50,
    discount: 30,
    stockQuantity: 90,
    sizeOptions: ['S', 'M', 'L', 'XL'],
    colorOptions: ['Black', 'White', 'Blue'],
    material: '100% Pure Cotton',
    description: 'Premium cotton polo shirt for casual elegance.',
    images: ['https://images.unsplash.com/photo-1617137968427-85924c800a22?q=80&w=800&auto=format&fit=crop'],
    status: 'published',
    isDummy: true,
    createdAt: new Date(),
  }
];

let isSeeding = false;

export async function seedProductsIfEmpty() {
  if (isSeeding) return;
  if (localStorage.getItem('products_seeded_v1') === 'true') return;

  isSeeding = true;
  try {
    const productsRef = collection(db, 'products');
    
    // Quick check if we have products
    const limitQuery = query(productsRef, limit(1));
    const limitSnapshot = await getDocs(limitQuery);
    
    if (!limitSnapshot.empty) {
      localStorage.setItem('products_seeded_v1', 'true');
      isSeeding = false;
      return; // Already has products, skip.
    }
    
    console.log('Seeding dummy products...');
    const batch = writeBatch(db);
    
    for (const product of DUMMY_PRODUCTS) {
      batch.set(doc(db, 'products', product.id), product);
    }
    await batch.commit();
    localStorage.setItem('products_seeded_v1', 'true');
    console.log('Seeding complete.');
  } catch (error) {
    console.error('Error seeding products:', error);
  } finally {
    isSeeding = false;
  }
}
