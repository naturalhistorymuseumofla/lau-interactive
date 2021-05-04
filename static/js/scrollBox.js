/*
const links = document.querySelectorAll("a");
 
for (const link of links) {
  link.addEventListener("click", clickHandler);
}
 
function clickHandler(e) {
  e.preventDefault();
  const href = this.getAttribute("href");
 
  document.querySelector(href).scrollIntoView({
    behavior: "smooth"
  });
}
*/


$(document).ready(function(){
	var contentSection = $('.card__content');
	var navigation = $('nav');
	
	//when a nav link is clicked, smooth scroll to the section
	$("a").on('click', function(event) {
    event.preventDefault();
		smoothScroll($(this.hash));
		//applyActiveClass($(this)[0]);
	});
	
	
	//update navigation on scroll...
	contentSection.on('scroll', function(){
		updateNavigation();
	})
	//...and when the page starts
	updateNavigation();
	
	/////FUNCTIONS
	function updateNavigation(){
		//$('.card__container').each(function(){
		const sections = document.getElementsByClassName('card__container');
		for (let section of sections) {

			var sectionName = section.id;
			var navigationMatch = $(`a[href="#${sectionName}"]`)
			//var navigationMatch = $(`nav a[href="#' + sectionName + '"]`);
			const amountScrolled = contentSection.scrollTop();
			const sectionHeight = $(section).height();
			const sectionEnd =  sectionHeight + section.offsetTop;
			const scrollBoxHeight = contentSection.height();
			const lowerThreshold = section.offsetTop - (scrollBoxHeight/5);
			const upperThreshold = sectionEnd - (scrollBoxHeight/5)


			if (lowerThreshold < amountScrolled  && amountScrolled < upperThreshold) {
				applyActiveClass(navigationMatch);
				//navigationMatch.addClass('button--active');
			} else {
				removeActiveClass(navigationMatch);
				//navigationMatch.removeClass('button--active');
			}
			
		};
	}
	
				/*
      if( ($(section).offset().top - $('.card__content').height()/2 < $('.card__content').scrollTop()) &&
          ($(section).offset().top + $(section).height() - $('.card__content').height()/2 > $('.card__content').scrollTop())) {
						*/
	

});

function smoothScroll(target){
	const position = target.position().top;
	($('.card__content')).animate({
		scrollTop: target[0].offsetTop
	}, 800);
}

function removeActiveClass(button) {
	// Remove active classes
	button.removeClass('button--active');
	Array.from(button.find('path')).forEach((el) => el.classList.remove('button__path--active'));
	const caption = button.parent().parent().find('.button__caption')
	caption.removeClass('button__caption--active');
}

	//Array.from(document.querySelectorAll('.button--active')).forEach((el) => el.classList.remove('button--active'));
	//Array.from(document.querySelectorAll('.button__path--active')).forEach((el) => el.classList.remove('button__path--active'));
	//Array.from(document.querySelectorAll('.button__caption--active')).forEach((el) => el.classList.remove('button__caption--active'));



function applyActiveClass(button) {
	// Add active classes to elements children
	button.addClass('button--active');
	Array.from(button.find('path')).forEach((el) => el.classList.add('button__path--active'));
	const caption = button.parent().parent().find('.button__caption');
	caption.addClass('button__caption--active');
}
