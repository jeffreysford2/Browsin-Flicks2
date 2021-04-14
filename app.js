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



const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/MovieBrowse';

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

const sessionConfig = {
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
    console.log('req Monkey', req.user)
    res.locals.currentUser = req.user;
    // res.locals.success = req.flash('success');
    // res.locals.error = req.flash('error');
    next();
})


app.get('/', async (req, res) => {
    const filterVals = req.query
    const endPoint = analyzeObject(req)
    const movies = await browseMovies(endPoint)
    await res.render('home', { movies, filterVals })
})

app.get('/login', async (req, res) => {
    await res.render('users/login')
})

app.get('/register', async (req, res) => {
    await res.render('users/register')
})

app.post('/register', catchAsync(async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        // user.likes.push('791373')
        // user.likes.push('508442')
        console.log('look', typeof (user.likes))
        const registeredUser = await User.register(user, password);
        console.log(`registerdUser:${registeredUser}`)
        const name = await registeredUser.username
        console.log('response:', res.user)
        req.login(registeredUser, err => {
            if (err) return next(err);
            //req.flash('success', 'Welcome to Yelp Camp!');
            res.redirect('/');
        })

    } catch (e) {
        const errorMessage = e.message;
        res.redirect('/register');
    }

}))
module.exports.login = (req, res) => {
    //res.redirect('/campgrounds')
    const redirectUrl = '/';
    res.redirect(redirectUrl);
};

app.post('/login', passport.authenticate('local', { failureRedirect: '/login' }), async (req, res) => {
    //res.redirect('/campgrounds')
    console.log('hello')
    const redirectUrl = '/';
    res.redirect(redirectUrl);
});

app.get('/logout', async (req, res) => {
    req.logout();
    res.redirect('/');
})

app.get('/:id', catchAsync(async (req, res, next) => {
    // res.locals.currentUser = req.user;
    // console.log('currentUser is:', currentUser)
    const movieId = String(req.params.id)
    console.log(req.user)
    const movie = await getMovieById(movieId)
    await console.log(movie)
    const cast = await getCastById(movieId)
    const watchProvidersUS = await getWatchProvidersById(movieId)

    await res.render('show', { movie, cast, watchProvidersUS })
}))

app.post('/:id', catchAsync(async (req, res, next) => {
    const movieId = String(req.params.id)
    console.log('movieId', movieId)
    console.log('reqDogUser', req.user)
    console.log('req.user.likes', req.user.likes)
    const currentLikes = req.user.likes
    console.log(currentLikes)
    console.log(currentLikes.keys)
    console.log(typeof (currentLikes))
    console.log(movieId)
    console.log(typeof (movieId))
    var currentLikesArray = Array.prototype.slice.call(currentLikes)
    console.log(currentLikesArray)
    console.log(typeof (currentLikesArray))
    var temp = [movieId]
    var updatedLikes = currentLikesArray.concat(temp)
    console.log(typeof (updatedLikes))
    console.log('updatedLikes,', updatedLikes)
    // res.locals.currentUser = req.user;
    // console.log('currentUser is:', currentUser)
    await db.collection("users").updateOne({ username: req.user.username }, { $set: { likes: updatedLikes } })

    console.log(req.user)
    const movie = await getMovieById(movieId)
    await console.log(movie)
    const cast = await getCastById(movieId)
    const watchProvidersUS = await getWatchProvidersById(movieId)

    await setTimeout(res.render('show', { movie, cast, watchProvidersUS }), 1000)
}))

app.listen(3000, () => {
    console.log('serving on port 3000')
})


//*********Middleware before rendering show********

function analyzeObject(obj) {
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
    console.log('filters=', filters)

    // const genresTypes = []

    // for (let j = 0; j < length; j++) {
    //     genresTypes.push(String(Object.values(genreList)[j].name).toLowerCase())
    // }
    const genresTypes = Object.keys(genreList)
    console.log(genresTypes)
    // console.log(genresTypesTwo)

    const intersection = filters.filter(element => genresTypes.includes(element));

    let codes = ''
    for (let genre of intersection) {
        codes = codes + genreList[genre] + ','
    }
    const editedCodes = codes.slice(0, -1)
    console.log(codes)

    genreString = genreString + `&with_genres=${editedCodes}`

    console.log(codes)
    const filterString = ratingString + minYearString + maxYearString + wellKnownString + genreString + '&sort_by=vote_average.desc'
    console.log(filterString)
    return filterString;
}

async function browseMovies(filterString) {
    const path = '/discover/movie/';
    const url = generateUrl(path) + `${filterString}`
    console.log(url)
    const movies = await requestMovies(url, renderSearchMovies, handleError)
    return movies
}

function generateUrl(path) {
    const url = `https://api.themoviedb.org/3${path}?api_key=${API_KEY}`;
    return url;
}

async function requestMovies(url, onComplete, onError) {
    const response = await fetch(url)
        .then((res) => res.json())
        .then(onComplete)
        .catch(onError)
    return response
}

async function requestMovie(url, onComplete, onError) {
    const response = await fetch(url)
        .then((res) => res.json())
        .then(onComplete)
        .catch(onError)
    return response
}

function renderSearchMovies(data) {
    const movies = data.results;
    return movies
}

function renderSearchMovie(data) {
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
    const movie = await requestMovie(url, renderSearchMovie, handleError)
    return movie
}

async function getCastById(stringId) {
    const path = `/movie/${stringId}/credits`
    const url = generateUrl(path)

    const cast = await requestMovie(url, renderSearchMovie, handleError)
    return cast
}

async function getWatchProvidersById(movieId) {
    const path = `/movie/${movieId}/watch/providers`
    const url = generateUrl(path)
    const watchProviders = await requestMovie(url, renderSearchMovie, handleError)
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



