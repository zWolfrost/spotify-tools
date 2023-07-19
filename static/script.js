const QUERY = document.getElementById("download-field")
const BUTTON = document.getElementById("download-button")

const url = window.location.href


async function post(url, body)
{
   let req = {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
         "Accept": "application/json"
      },
      body: JSON.stringify(body)
   }

   return fetch(url, req)
}


QUERY.addEventListener("keypress", function(e)
{
   if (e.key === "Enter")
   {
      e.preventDefault();
      BUTTON.click();
   }
});

BUTTON.addEventListener("click", async () =>
{
   let query = QUERY.value

   /*setTimeout(() => setPercentage(10), 1000)
   setTimeout(() => setPercentage(30), 1500)
   setTimeout(() => setPercentage(70), 2100)
   setTimeout(() => setPercentage(100), 3000)
   setTimeout(resetDownload, 3500)*/


   let res = await post(url, {query: query}).then(res => res.json())


   if ("error" in res)
   {
      setMessage(res.error)
   }
   else
   {
      downloadStart()
      recursiveCheckID(res.id)
   }

   async function recursiveCheckID(id)
   {
      let res = await fetch(`download?id=${id}`)

      try
      {
         let resJSON = await res.json()

         downloadProgress(resJSON.progresscount, resJSON.totalcount)

         recursiveCheckID(id)
      }
      catch
      {
         window.open(`download?id=${id}`, "_self")

         downloadEnd()
      }
   }
})


function downloadStart()
{
   QUERY.value = ""
   BUTTON.innerText = "Downloading..."

   inputsAreDisabled(true)
}
function downloadProgress(progresscount, totalcount)
{
   BUTTON.innerText = `Downloading... (${Math.floor(progresscount)}/${totalcount})`
   QUERY.style.setProperty("--progress-percent", (progresscount / totalcount * 100) + "%");
}
function downloadEnd()
{
   QUERY.style.setProperty("--progress-percent", "0%");

   BUTTON.innerText = "Download"

   inputsAreDisabled(false)
}

function setMessage(message, timeout=2)
{
   BUTTON.disabled = true

   QUERY.value = ""

   let prevPlaceholder = QUERY.placeholder
   QUERY.placeholder = message

   setTimeout(() =>
   {
      QUERY.placeholder = prevPlaceholder

      BUTTON.disabled = false
   }, timeout*1000)
}

function inputsAreDisabled(disabled)
{
   QUERY.disabled = disabled
   BUTTON.disabled = disabled
}