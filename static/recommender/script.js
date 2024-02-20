
const REFRESH_BUTTON = document.getElementById("refresh-button")
const TRACKLIST = document.getElementsByClassName("tracklist")[0]


REFRESH_BUTTON.addEventListener("click", async () =>
{
   displayTracklist()
   disableInputs(true)

   let info = await fetch("recommend").then(res => res.json())


   if ("error" in info)
   {
      alert(info.error)
   }
   else
   {
      displayTracklist(info)
      disableInputs(false)
   }
})



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
}


function displayTracklist(tracklist=[])
{
   if (TRACKLIST.childNodes.length === 0 && tracklist.length > 0)
   {
      for (const track of tracklist)
      {
         TRACKLIST.appendChild(createSpotifyEmbed(track))
      }

      TRACKLIST.classList.add("open")
   }
   else if (TRACKLIST.classList.contains("open"))
   {
      TRACKLIST.classList.remove("open")

      TRACKLIST.addEventListener("transitionend", () =>
      {
         TRACKLIST.textContent = ""
         displayTracklist(tracklist)
      }, {once: true})
   }
}
function createSpotifyEmbed(track)
{
   const EMBED_OPTS =
   {
      class: "track",
      src: `https://open.spotify.com/embed/${track.type}/${track.id}`,
      width: "100%",
      height: "80",
      frameBorder: "0",
      //allow: "encrypted-media",
      loading: "lazy"
   }

   const IFRAME = document.createElement("iframe")

   for (const [key, value] of Object.entries(EMBED_OPTS))
   {
      IFRAME.setAttribute(key, value)
   }

   return IFRAME
}


function disableInputs(disabled)
{
   REFRESH_BUTTON.disabled = disabled
}