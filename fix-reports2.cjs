const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminReports.tsx', 'utf8');

const targetStr = `      {/* Main KPI Stats */}`;
      
const errorHtml = `      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3 w-full">
          <AlertCircle className="text-red-600 mt-0.5 shrink-0" size={18} />
          <div>
            <h3 className="text-sm font-bold text-red-900">Database Connection Error</h3>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Main KPI Stats */}`;

content = content.replace(targetStr, errorHtml);
fs.writeFileSync('src/pages/admin/AdminReports.tsx', content);
