$(document).ready(function(){
    $('.header-sheet').click(function(){
        $(this).parents('.sheet').toggleClass('expanded');
        $(this).next().toggleClass('hidden');
    });

    $('.header-selector').click(function(){
        $(this).parents('.selector').toggleClass('expanded');
        $(this).next().toggleClass('hidden');
    });
});