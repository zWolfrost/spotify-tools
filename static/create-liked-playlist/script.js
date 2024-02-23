
const CREATE_BUTTON = document.getElementById("create-button")
const TRACKLIST = document.getElementsByClassName("tracklist")[0]

CREATE_BUTTON.addEventListener("click", async () =>
{
   disableInputs(true)

   let info = await fetch("create").then(res => res.json())


   if ("error" in info)
   {
      alert(info.error)
   }
   else
   {
      disableInputs(false)
   }
})

function disableInputs(disabled)
{
   CREATE_BUTTON.disabled = disabled
}