async function setIcon()
{
   const iconElement = document.getElementById("user-icon")
   let iconUrl = await fetch("/assets/icon").then(res => res.json()).catch(() => iconUrl.url = null)

   if (iconElement && iconUrl?.url) iconElement.src = iconUrl.url;
}

setIcon();