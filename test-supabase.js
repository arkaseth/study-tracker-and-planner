const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const dom = new JSDOM(
  `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
  <script>
    console.log("Supabase type:", typeof window.supabase);
  </script>
</body>
</html>`,
  { runScripts: "dangerously", resources: "usable" },
);

dom.window.document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    console.log("After timeout Supabase type:", typeof dom.window.supabase);
  }, 1000);
});
