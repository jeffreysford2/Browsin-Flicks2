function testFunction() {
    console.log("TEST");
}

function movieSection(movies) {
    const section = document.createElement('section');
    section.classList = 'section';

    movies.map((movie) => {
        if (movie.poster_path) {
            const img = document.createElement('img');
            img.src = IMAGE_URL + movie.poster_path;
            img.setAttribute('data-movie-id', movie.id)

            section.appendChild(img);
        }
    })
    return section;
}

function createMovieContainer(movies, title = '') {
    const movieElement = document.createElement('div');
    movieElement.setAttribute('class', 'movie');

    const header = document.createElement('h2');
    header.innerHTML = title;

    const content = document.createElement('div');
    content.classList = 'content';

    const contentClose = `<p id="content-close">X</p>`;

    content.innerHTML = contentClose;

    const section = movieSection(movies);

    movieElement.appendChild(header);
    movieElement.appendChild(section);
    movieElement.appendChild(content);
    return movieElement

}

function renderSearchMovies(data) {
    //data.results[]
    movieSearchable.innerHTML = '';
    const movies = data.results;
    const movieBlock = createMovieContainer(movies);
    movieSearchable.appendChild(movieBlock);
    console.log(data);
}

function renderMovies(data) {
    //data.results[]

    const movies = data.results;
    const movieBlock = createMovieContainer(movies, this.title);
    moviesContainer.appendChild(movieBlock);
    console.log(data);
}


function handleError(error) {
    console.log('Error: ', error)
}

buttonElement.onclick = function (event) {
    event.preventDefault();
    const value = inputElement.value;
    console.log(`value: ${value}`)
    searchMovie(value);

    inputElement.value = '';
    console.log(value)
    //console.log("Button has been clicked")
}

function generateStringOfFilters() {
    var genreString = '';
    for (let genre of genres) {
        if (genre.checked == 1) {
            for (let i = 0; i < genres.length; i++) {
                //console.log(genre.name)
                if (genreList[i].name.toLowerCase() == genre.name) {
                    const genreCode = genreList[i].id;
                    //genreString.concat(String(genreCode));
                    genreString = genreString + '&with_genres=' + String(genreCode)
                    //genreString.concat("HAPPy")
                    //console.log(genreString)
                }
            }
            //const genreCode = genreList.filter(obj => obj.name == genre.name);

        }
    }

    //Should put the following into it's own function
    var filterString = genreString;

    if (beginningYear.value > 1900) {
        console.log("AAAAAA")
        const beginningYearString = `&primary_release_date.gte=${beginningYear.value}-01-01`
        filterString = filterString + beginningYearString
    }

    if (endingYear.value > 1900) {
        console.log("BBBBBB")
        const endingYearString = `&primary_release_date.lte=${endingYear.value}-12-31`
        filterString = filterString + endingYearString
    }

    const rating = getMinimumRating()
    const ratingString = `&vote_average.gte=${rating}`
    filterString = filterString + ratingString


    const wellKnown = getWellKnown()
    const wellKnownString = `&vote_count.gte=${wellKnown}`
    filterString = filterString + wellKnownString

    filterString = filterString + '&sort_by=vote_average.desc'



    console.log(filterString)

    return filterString;
}

//function that runs when the browse button is clicked
browseButtonElement.onclick = function (event) {
    event.preventDefault();
    const filterString = generateStringOfFilters();
    console.log(filterString)
    browseMovies(filterString);
}

function createIframe(video) {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${video.key}`;
    iframe.width = 360;
    iframe.height = 315;
    iframe.allowFullscreen = true;

    return iframe;
}

function createVideoTemplate(data, content) {
    console.log('videos:', data)
    content.innerHTML = '<p id="content-close">X</p>';
    const videos = data.results;
    const length = videos.length > 4 ? 4 : videos.length;
    const iframeContainer = document.createElement('div');

    for (let i = 0; i < length; i++) {
        const video = videos[i];
        const iframe = createIframe(video);
        iframeContainer.appendChild(iframe);
        content.appendChild(iframeContainer);
    }
}

//Event Delegation
document.onclick = function (event) {
    const target = event.target;
    if (target.tagName.toLowerCase() === 'img') {
        console.log('clicked image')
        console.log(target)
        console.log(event)
        const movieId = target.dataset.movieId; //Gets movieId
        console.log(`MovieId = ${movieId}`)
        //getting the section that is the parent of the elements
        const section = event.target.parentElement;
        const content = section.nextElementSibling; //content
        content.classList.add('content-display');

        const path = `/movie/${movieId}/videos`;
        const url = generateUrl(path);
        //fetch movie videos
        fetch(url)
            .then((res) => res.json())
            .then((data) => createVideoTemplate(data, content))
            .catch((error) => {
                console.log(`Error: ${error}`);
            });
    }
    if (target.id === 'content-close') {
        const content = target.parentElement;
        content.classList.remove('content-display');
    }
}