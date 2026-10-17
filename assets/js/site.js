// Open guitar thumbnails in a simple lightbox.
const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox.querySelector("img");

document.querySelectorAll("[data-lightbox]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    lightboxImage.src = link.href;
    lightboxImage.alt = link.querySelector("img").alt;
    lightbox.showModal();
  });
});

// Click outside the photo to close.
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});
