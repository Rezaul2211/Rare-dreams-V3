const fs = require('fs');
let content = fs.readFileSync('src/pages/Account.tsx', 'utf8');

const oldStr = `  const [orders, setOrders] = useState<Order[]>([]);
  const [totalProductCount, setTotalProductCount] = useState<number>(0);`;

const newStr = `  const [orders, setOrders] = useState<Order[]>([]);
  const [totalProductCount, setTotalProductCount] = useState<number>(0);
  const [quotaError, setQuotaError] = useState<string | null>(null);`;

content = content.replace(oldStr, newStr);

const oldFetchStr = `      } catch (err) {
        console.error("Error fetching background stats:", err);
      }`;
      
const newFetchStr = `      } catch (err: any) {
        console.error("Error fetching background stats:", err);
        if (err.message?.includes('Quota') || err.code === 'resource-exhausted') {
          setQuotaError("Firebase Free Tier Quota Exceeded. History may be unavailable.");
        }
      }`;
      
content = content.replace(oldFetchStr, newFetchStr);
fs.writeFileSync('src/pages/Account.tsx', content);
