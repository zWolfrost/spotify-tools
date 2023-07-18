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


BUTTON.addEventListener("click", async () =>
{
   let query = QUERY.value

   disableDownload()


   /*setTimeout(() => setPercentage(10), 1000)
   setTimeout(() => setPercentage(30), 1500)
   setTimeout(() => setPercentage(70), 2100)
   setTimeout(() => setPercentage(100), 3000)
   setTimeout(resetDownload, 3500)*/


   let res = await post(url, {query: query}).then(res => res.json())


   console.log(res.id)
   recursiveCheckID(res.id)

   async function recursiveCheckID(id)
   {
      let res = await fetch(`download?id=${id}`)

      try
      {
         let resJSON = await res.json()

         console.log(resJSON)

         setProgress(resJSON.progresscount, resJSON.totalcount)

         recursiveCheckID(id)
      }
      catch
      {
         window.open(`download?id=${id}`, "_self")

         resetDownload()
      }
   }
})

function disableDownload()
{
   QUERY.value = ""
   BUTTON.innerText = "Downloading..."

   QUERY.disabled = true
   BUTTON.disabled = true
}
function setProgress(progresscount, totalcount)
{
   BUTTON.innerText = `Downloading... (${Math.floor(progresscount)}/${totalcount})`
   QUERY.style.setProperty("--progress-percent", (progresscount / totalcount * 100) + "%");
}
function resetDownload()
{
   QUERY.style.setProperty("--progress-percent", "0%");

   BUTTON.innerText = "Download"

   QUERY.disabled = false
   BUTTON.disabled = false
}