const fs = require('fs');
let content = fs.readFileSync('src/pages/Account.tsx', 'utf8');

const oldStr = `                      <div className="space-y-3">
                        {filteredList.length === 0 ? (`;

const newStr = `                      <div className="space-y-3">
                        {quotaError && (
                          <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2 mb-3">
                            <AlertCircle className="text-red-600 mt-0.5 shrink-0" size={16} />
                            <div>
                              <p className="text-xs text-red-800 font-medium">{quotaError}</p>
                            </div>
                          </div>
                        )}
                        {filteredList.length === 0 ? (`;

content = content.replace(oldStr, newStr);
fs.writeFileSync('src/pages/Account.tsx', content);
