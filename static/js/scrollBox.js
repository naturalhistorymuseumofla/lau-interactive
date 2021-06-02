
$(document).ready(function(){
	var contentSection = $('.card__content');
	var navigation = $('nav');
	
	// When a nav link is clicked, smooth scroll to the section
	$("a").on('click', function(event) {
    event.preventDefault();
		smoothScroll($(this.hash));
		//applyActiveClass($(this)[0]);
	});
	
	
	// Update navigation on scroll...
	contentSection.on('scroll', function(){
		updateNavigation();
	})
	// ...and when the page starts
	updateNavigation();
	

	function updateNavigation(){
		const sections = document.getElementsByClassName('card__container');
		for (let section of sections) {
			var sectionName = section.id;
			var navigationMatch = $(`a[href="#${sectionName}"]`)
			const amountScrolled = contentSection.scrollTop();
			const sectionHeight = $(section).height();
			const sectionEnd =  sectionHeight + section.offsetTop;
			const scrollBoxHeight = contentSection.height();
			const lowerThreshold = section.offsetTop - (scrollBoxHeight/5);
			const upperThreshold = sectionEnd - (scrollBoxHeight/5)
			// Add/remove class based on if scrolling in target section
			if (lowerThreshold < amountScrolled  && amountScrolled < upperThreshold) {
				applyActiveClass(navigationMatch);
			} else {
				removeActiveClass(navigationMatch);
			}
		};
	}
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


function applyActiveClass(button) {
	// Add active classes to elements children
	button.addClass('button--active');
	Array.from(button.find('path')).forEach((el) => el.classList.add('button__path--active'));
	const caption = button.parent().parent().find('.button__caption');
	caption.addClass('button__caption--active');
}
