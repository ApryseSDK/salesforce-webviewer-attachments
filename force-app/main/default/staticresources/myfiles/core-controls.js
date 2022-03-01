Core.setWorkerPath('../lib/core');

const xfdfString = `<?xml version="1.0" encoding="UTF-8" ?><xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve"><pdf-info xmlns="http://www.pdftron.com/pdfinfo" version="2" import-version="4" /><fields /><annots><square page="0" rect="138.180,570.180,413.330,695.030" color="#E44234" flags="print" name="8ad6ceb1-aed3-726c-4862-14e42b33a219" title="Guest" subject="Rectangle" date="D:20220118114254-08'00'" creationdate="D:20220118114254-08'00'"/></annots><pages><defmtx matrix="1,0,0,-1,0,792" /></pages></xfdf>`

Core.createDocument('../../myfiles/webviewer-demo-annotated.pdf').then(async (doc) => {
  console.log(doc);
  const data = await doc.getFileData({
    // saves the document with annotations in it
    xfdfString
  });
  const arr = new Uint8Array(data);
  const blob = new Blob([arr], { type: 'application/pdf' });
  console.log(blob);
  saveAs(blob, 'output.pdf');
}).catch(error => {
  console.log(error);
});