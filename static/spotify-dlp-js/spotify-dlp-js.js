const DL_QUERY = document.getElementById("download-field")
const DL_BUTTON = document.getElementById("download-button")
const TRIM_INDEXES = document.getElementById("trim-indexes")


const url = window.location.href


DL_QUERY.addEventListener("keypress", function(e)
{
   if (e.key === "Enter")
   {
      e.preventDefault();
      DL_BUTTON.click();
   }
});

DL_BUTTON.addEventListener("click", async () =>
{
   let query = DL_QUERY.value
   let trim_indexes = TRIM_INDEXES.value.split(":").filter(n => n !== "")

   downloadStart()


   let res = await fetch(url, {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
         "Accept": "application/json"
      },
      body: JSON.stringify({
         query: query,
         trim: trim_indexes
      })
   }).then(res => res.json())


   if ("error" in res)
   {
      downloadEnd()
      setMessage(res.error)
   }
   else
   {
      recursiveCheckID(res.id)
   }

   async function recursiveCheckID(id)
   {
      let res = await fetch(`update?id=${id}`).then(res => res.json())

      downloadProgress(res.percent, res.remainingSeconds, res.trackCount)

      if (res.complete)
      {
         window.open(`download?id=${id}`, "_self")
         downloadEnd()
      }
      else
      {
         recursiveCheckID(id)
      }
   }
})


//downloadStart();let p=0,i=setInterval(()=>{downloadProgress(++p);if(p==100){clearInterval(i);downloadEnd()}}, 20 )


function downloadStart()
{
   DL_QUERY.value = ""
   TRIM_INDEXES.value = ""
   DL_BUTTON.innerText = "Downloading..."

   inputsAreDisabled(true)
}
function downloadProgress(percent, remainingSeconds, totalCount=1)
{
   DL_QUERY.style.setProperty("--progress-percent", percent + "%");
   TRIM_INDEXES.value = remainingSeconds === null ? "" : `${remainingSeconds?.toFixed(2)}s`
   DL_BUTTON.innerText = `Downloading... (${Math.floor(totalCount*percent/100)}/${totalCount})`
}
function downloadEnd()
{
   DL_QUERY.style.setProperty("--progress-percent", "0%");

   TRIM_INDEXES.value = ""
   DL_BUTTON.innerText = "Download"

   inputsAreDisabled(false)
}

function setMessage(message, timeout=2)
{
   DL_BUTTON.disabled = true

   DL_QUERY.value = ""

   let prevPlaceholder = DL_QUERY.placeholder
   DL_QUERY.placeholder = message

   setTimeout(() =>
   {
      DL_QUERY.placeholder = prevPlaceholder

      DL_BUTTON.disabled = false
   }, timeout*1000)
}

function inputsAreDisabled(disabled)
{
   DL_QUERY.disabled = disabled
   TRIM_INDEXES.disabled = disabled
   DL_BUTTON.disabled = disabled
}