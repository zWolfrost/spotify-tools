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


   let info = await fetch(url, {
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


   if ("error" in info)
   {
      downloadEnd()
      setMessage(info.error)
   }
   else
   {
      displayInfo(info)
      recursiveCheckID(info.id)
   }

   async function recursiveCheckID(id)
   {
      let res = await fetch(`update?id=${id}`).then(res => res.json())

      downloadProgress(res.percent, res.remainingSeconds, res.trackCount)

      if (res.complete)
      {
         window.open(`download?id=${id}`, "_self")
         displayInfo()
         downloadEnd()
      }
      else
      {
         recursiveCheckID(id)
      }
   }
})



/*displayInfo(
   {
      "tracklist":
      [
         { "type": "episode", "id": "14VSmwCslwrJvi3PaSvhNM", },
         { "type": "episode", "id": "3WErAlEzeADyzNLiIr8aXV", },
         { "type": "episode", "id": "6RcYx5vypWSjcnat6YiJU6", },
         { "type": "episode", "id": "5KgyL40hs5UXwyiJiYfNO9", }
      ]
   }
)*/
//downloadStart();let p=0,i=setInterval(()=>{downloadProgress(++p);if(p==100){clearInterval(i);downloadEnd()}}, 20 )



function animate(el, animation)
{
   return new Promise(resolve =>
   {
      el.style.animation = "none";
      el.offsetHeight;
      el.style.animation = "none";

      el.style.animation = animation;

      el.addEventListener("animationend", function()
      {
         el.style.animation = "none";
         resolve();
      }, {once: true});
   })
};


async function displayInfo(info={tracklist: []}, transitionSeconds=1)
{
   const TRACKLIST = document.getElementById("tracklist")


   if (TRACKLIST.childNodes.length === 0)
   {
      animate(TRACKLIST, `slidein ${transitionSeconds}s normal ease-out`)
      addEmbeds(info)
   }
   else
   {
      await animate(TRACKLIST, `slidein ${transitionSeconds}s reverse ease-in`)

      TRACKLIST.textContent = ""
      displayInfo(info)
   }


   function addEmbeds(info)
   {
      for (let track of info.tracklist)
      {
         const EMBED_OPTS =
         {
            class: "track",
            src: `https://open.spotify.com/embed/${track.type}/${track.id}`,
            width: "100%",
            height: "152",
            frameBorder: "0",
            //allow: "encrypted-media",
            loading: "lazy"
         }

         const IFRAME = document.createElement("iframe")

         for (const [key, value] of Object.entries(EMBED_OPTS))
         {
            IFRAME.setAttribute(key, value)
         }

         TRACKLIST.append(IFRAME)
      }
   }
}


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