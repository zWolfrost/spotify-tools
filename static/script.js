const QUERY = document.getElementById("download-field")
const BUTTON = document.getElementById("download-button")
const TRIMBEG = document.getElementById("trim-beg-index")
const TRIMEND = document.getElementById("trim-end-index")


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
   let trimbeg = TRIMBEG.value
   let trimend = TRIMEND.value

   downloadStart()


   let res = await post(url, { query: query, trim: [trimbeg, trimend] }).then(res => res.json())


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

      downloadProgress(res.percent, res.trackCount)

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
   QUERY.value = ""
   BUTTON.innerText = "Downloading..."

   inputsAreDisabled(true)
}
function downloadProgress(percent, totalCount=1)
{
   BUTTON.innerText = `Downloading... (${Math.floor(totalCount*percent/100)}/${totalCount})`
   QUERY.style.setProperty("--progress-percent", percent + "%");
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