const fs = require('fs');
const h = fs.readFileSync('data/permit-reimburse-management.html', 'utf8');
const ids = [
  'reimburseTableBody', 'reimburseDetailModal', 'detailTimeline',
  'detailModalTitle', 'detailModalClose', 'detailModalOk',
  'detailTotalDays', 'detailTotalHours', 'detailModalSubtitle'
];
ids.forEach(id => {
  const re = new RegExp('id="' + id + '"', 'g');
  const m = h.match(re);
  console.log(id + ': ' + (m ? m.length : 0) + ' occurrences');
});
