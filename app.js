if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
const API_KEY = process.env.API_KEY;
const secret_KEY = process.env.SECRET;

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const fetch = require("node-fetch");
const IMAGE_URL = 'https://image.tmdb.org/t/p/w342';
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');
const isLoggedIn = require('./middleware');
const catchAsync = require('./utils/catchAsync');


const MongoDBStore = require("connect-mongo")(session);

const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/movieBrowse';

mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});


const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')))

const store = new MongoDBStore({
    url: dbUrl,
    secret: secret_KEY,
    touchAfter: 24 * 3600
});

store.on('error', function (e) {
    console.log('session store error', e)
})

const sessionConfig = {
    store,
    secret: secret_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());
//const passportConfig = require('./config/passport')(passport);
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
})

//render Home screen.
app.get('/', catchAsync(async (req, res) => {
    const filterVals = req.query
    //if no filterVals
    let movies = []
    let showingTrending = {}
    if (Object.size(filterVals) === 0) {
        movies = await getTrendingMovies()
        showingTrending.trending = true
    } else {
        const endPoint = analyzeFilters(req)
        movies = await getMovies(endPoint)
    }
    await res.render('home', { movies, filterVals, showingTrending })
}))

app.get('/login', catchAsync(async (req, res) => {
    await res.render('users/login')
}))

app.get('/register', catchAsync(async (req, res) => {
    await res.render('users/register')
}))

app.post('/register', catchAsync(async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        const name = await registeredUser.username
        req.login(registeredUser, err => {
            if (err) return next(err);
            res.redirect('/');
        })
    } catch (e) {
        const errorMessage = e.message;
        res.redirect('/register');
    }
}))
module.exports.login = (req, res) => {
    const redirectUrl = '/';
    res.redirect(redirectUrl);
};

app.post('/login', passport.authenticate('local', { failureRedirect: '/login' }), catchAsync(async (req, res) => {
    const redirectUrl = '/';
    res.redirect(redirectUrl);
}));

app.get('/logout', catchAsync(async (req, res) => {
    req.logout();
    res.redirect('/');
}))

app.get('/:id', catchAsync(async (req, res, next) => {
    const movieId = String(req.params.id)
    const movie = await getMovieById(movieId)
    const cast = await getCastById(movieId)
    const watchProvidersUS = await getWatchProvidersById(movieId)
    await res.render('show', { movie, cast, watchProvidersUS })
}))

app.post('/:id', catchAsync(async (req, res, next) => {
    const movieId = String(req.params.id)
    const currentLikes = req.user.likes
    const movieOriginallyLiked = currentLikes.includes(movieId);
    var currentLikesArray = Array.prototype.slice.call(currentLikes)
    if (!movieOriginallyLiked) {
        var temp = [movieId]
        var updatedLikes = currentLikesArray.concat(temp)

        let uniqueLikes = updatedLikes.filter((c, index) => {
            return updatedLikes.indexOf(c) === index;
        });
        await db.collection("users").updateOne({ username: req.user.username }, { $set: { likes: uniqueLikes } })
    } else {
        const index = currentLikesArray.indexOf(movieId);
        if (index > -1) {
            var updatedLikes = currentLikesArray.splice(index, 1);
            let uniqueLikes = currentLikesArray.filter((c, index) => {
                return currentLikesArray.indexOf(c) === index;
            });
            await db.collection("users").updateOne({ username: req.user.username }, { $set: { likes: uniqueLikes } })
        }
    }
    const movie = await getMovieById(movieId)
    const cast = await getCastById(movieId)
    const watchProvidersUS = await getWatchProvidersById(movieId)
    res.redirect('back');
}))

const port = process.env.PORT || 3000

app.listen(port, () => {
    console.log(`serving on port ${port}`)
})

//*********Middleware before rendering show********

//Converts the filter input into an endpoint string
function analyzeFilters(obj) {
    const filterValues = obj.query
    var genreString = ''
    ratingString = `&vote_average.gte=${filterValues.rating}`
    minYearString = `&primary_release_date.gte=${filterValues.minYear}-01-01`
    maxYearString = `&primary_release_date.lte=${filterValues.maxYear}-12-31`
    wellKnownString = `&vote_count.gte=${filterValues.wellKnown}`
    const length = Object.size(genreList)
    const totalFilters = Object.size(filterValues)
    const filters = []
    for (let j = 0; j < totalFilters; j++) {
        filters.push(String(Object.keys(filterValues)[j]))
    }
    const genresTypes = Object.keys(genreList)
    const intersection = filters.filter(element => genresTypes.includes(element));
    let codes = ''
    for (let genre of intersection) {
        codes = codes + genreList[genre] + ','
    }
    const editedCodes = codes.slice(0, -1)
    genreString = genreString + `&with_genres=${editedCodes}`
    const filterString = ratingString + minYearString + maxYearString + wellKnownString + genreString + '&sort_by=vote_average.desc'
    return filterString;
}

//Returns movies based on the string input from the filters
async function getMovies(filterString) {
    const path = '/discover/movie/';
    const url = generateUrl(path) + `${filterString}`
    const movies = await requestMovies(url, renderSearchMovies, handleError)
    return movies
}

async function getTrendingMovies() {
    const path = '/trending/movie/week';
    const url = generateUrl(path)
    const movies = await requestMovies(url, renderSearchMovies, handleError)

    return movies
}

//generates a url based on the path
function generateUrl(path) {
    const url = `https://api.themoviedb.org/3${path}?api_key=${API_KEY}`;
    return url;
}

//requests movies from the API
async function requestMovies(url, onComplete, onError) {
    const response = await fetch(url)
        .then((res) => res.json())
        .then(onComplete)
        .catch(onError)
    return response
}

//returns multiple movies
function renderSearchMovies(data) {
    const movies = data.results;
    return movies
}

//returns one movie
function renderSearchOneMovie(data) {
    const movie = data;
    return movie
}

function handleError(error) {
    console.log('Error: ', error)
}



Object.size = function (obj) {
    var size = 0,
        key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

async function getMovieById(stringId) {
    const path = `/movie/${stringId}`
    const url = generateUrl(path)
    const movie = await requestMovies(url, renderSearchOneMovie, handleError)
    return movie
}

async function getCastById(stringId) {
    const path = `/movie/${stringId}/credits`
    const url = generateUrl(path)
    const cast = await requestMovies(url, renderSearchOneMovie, handleError)
    return cast
}

async function getWatchProvidersById(movieId) {
    const path = `/movie/${movieId}/watch/providers`
    const url = generateUrl(path)
    const watchProviders = await requestMovies(url, renderSearchOneMovie, handleError)
    const watchProvidersUS = watchProviders.results.US
    return watchProvidersUS
}

genreList = {
    "action": 28,
    "adventure": 12,
    "animated": 16,
    "comedy": 35,
    "crime": 80,
    "documentary": 99,
    "drama": 18,
    "family": 10751,
    "fantasy": 14,
    "history": 36,
    "horror": 27,
    "music": 10402,
    "mystery": 9648,
    "romance": 10749,
    "science_fiction": 878,
    "tv_movie": 10770,
    "thriller": 53,
    "war": 10752,
    "western": 37,
}



