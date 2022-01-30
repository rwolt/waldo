
import StartMenu from './components/StartMenu';
import Header from './components/Header';
import Map from './components/Map';
import { useEffect, useState } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import { getDocs, query, where, collection, getDoc, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import {db, storage} from './utils/firebase';

function App() {
  const [showLevelSelect, setShowLevelSelect] = useState(true);
  const [currentLevel, setCurrentLevel] = useState({name: '', imageURL: ''});
  const [currentSession, setCurrentSession] = useState({id: ''});
  //X and Y Coordinates for center of the targeting box
  const [pageX, setPageX] = useState(0);
  const [pageY, setPageY] = useState(0);
  const [showTargetBox, setShowTargetBox] = useState(false);
  const [showCharacterTargets, setShowCharacterTargets] = useState(false);
  const [showKey, setShowKey] = useState(false);
  //Mock data for the characters array
  const [currentCharacter, setCurrentCharacter] = useState('');
  const [characters, setCharacters] = useState([]);
  const [message, setMessage] = useState({});
  const [timer, setTimer] = useState(0);
  const [allFound, setAllFound] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);

  useEffect(() => {
    //If there a character is currently being validated, show or hide the character target divs 
    if(currentCharacter !== '') {
      setShowCharacterTargets(true);
    } else {
      setShowCharacterTargets(false);
    }
  }, [currentCharacter])
  
  useEffect(() => {
    if(showCharacterTargets === true) {
      //Get the bounding rectangle of the selection box and the character box
      const targetBox = document.querySelector('.target-box').getBoundingClientRect();
      const charTarget = document.getElementById(`${currentCharacter} target`).getBoundingClientRect();
      //Check to see if the two divs overlap, if they do set the found property for the character to true
      if(checkOverlap(targetBox, charTarget)) {
        setCharacters(characters.map(char => {
          return(
            char.name === currentCharacter ? {...char, found: true, targetbox: {}} : 
            {...char}
          );
        }))  
        handleSnackbar({text: `You found ${currentCharacter}`, isCorrect: true});
      } else {
        //Remove the position from state
        setCharacters(characters.map(char => {
          return(
            char.name=== currentCharacter ? {...char, targetbox: {}} : 
            {...char}
          )
        }))
        handleSnackbar({text: `Try again`, isCorrect: false});
      };
      //Set the current character to an empty string to hide the character targets
      setCurrentCharacter('');
      setShowTargetBox(!showTargetBox);
    }
  }, [showCharacterTargets])

  useEffect(() => {
    //If every character has been found, end the game
    if(currentLevel && characters.every(char => char.found === true)){
      endSession();
    }
  }, [characters]) 

  const updateCoords = (e) => {
    setPageX(((e.nativeEvent.offsetX / document.querySelector('.map').clientWidth) * 100).toFixed(2));
    setPageY(((e.nativeEvent.offsetY / document.querySelector('.map').clientHeight) * 100).toFixed(2));
    setShowTargetBox(!showTargetBox);
  }
  
  const handleSelect = async (e) => {
    const {id} = e.currentTarget;  
    const uniqueId = characters.filter(char => char.name === id)[0].id;
    //Get the coordinates of the character from firebase
    const characterRef = doc(collection(db, 'characters'), uniqueId);
    //Store the coordinates in state
    const characterSnap = await getDoc(characterRef).then(doc => {
      setCharacters(characters.map(char => char.id === doc.id ? {...char, targetbox: doc.data().targetbox} : {...char}));
    }) 
    setCurrentCharacter(id);
  }

  const handleSnackbar = (message) => {
    //Show the message for 2 seconds and then hide the snackbar
    setMessage(message);  
    setShowSnackbar(true);
    setTimeout(() => {
      setShowSnackbar(false)
    }, 2000);
    //Delay change of message so style remains during animation
    setTimeout(() => {
      setMessage({});
    }, 2400);
  }

  const checkOverlap = (rect1, rect2) => {
    const overlap = !(rect1.left > rect2.right ||
                      rect1.right < rect2.left ||
                      rect1.bottom < rect2.top ||
                      rect1.top > rect2.bottom);
    return overlap;
  }
  
  const tick = () => {
    setTimer(timer + 1);
  }

  const startSession = async () => {
    //Post a doc with the level and start time  
    const docRef = await addDoc(collection(db, 'sessions'), {
      startTime: Date.now(),
      level: currentLevel.name
    })  
    setCurrentSession({id: docRef.id});
  }

  const endSession = async () => {
    //Stop the timer
    const sessionRef = doc(db, 'sessions', currentSession.id);
    await updateDoc((sessionRef), {endTime: Date.now()});
    setAllFound(true);
    //Show score and a form to enter name
    const time = await (await getDoc(sessionRef).then(doc => (doc.data().endTime - doc.data().startTime) / 1000)).toFixed(2);
    console.log(`You found all the characters. Time stop ${time} seconds`);
  }
  

  const getLevel = (e) => {
    const {id} = e.target;
    //Fetch map from the server
    getLevelImage(id);
    getCharacters(id);
    //Close the start menu on level select
    setShowLevelSelect(!showLevelSelect);
  }
  
  const getLevelImage = (name) => {
    //Fetch the level map from firebase cloud storage
    const levelImage = ref(storage, `levels/${name}.png`);
    getDownloadURL(levelImage).then(url =>{
      setCurrentLevel({name: name, imageURL: url});
    });
  }

  const getCharacters = async (name) => {
    //Fetch character docs for the current level from firebase
    const q = query(collection(db, 'characters'), where('level', '==', name));
    const charArray = [];
    const querySnapshot = await getDocs(q);
    //Map over the returned docs and add a found and id property
    querySnapshot.forEach(doc => charArray.push({...doc.data(), targetbox: {}, found: false, id: doc.id}));
    //Get the download url for each characters avatar from cloud storage
    charArray.forEach(char => {
      const imageRef = ref(storage, char.imageURL);
      getDownloadURL(imageRef).then(url => {
        char.imageURL = url;
    });
    setCharacters(charArray);
    });
  }
 
    return(
    //Show the start menu if levelSelect is true
    <div className="App">
      <Header 
        pageX={pageX} 
        pageY={pageY}
        showKey={showKey}
        setShowKey={setShowKey}
        characters={characters}
        timer={timer}
        tick={tick}
        allFound={allFound}
        showLevelSelect={showLevelSelect}
      />
      {showLevelSelect ? 
        <StartMenu
          getLevel={getLevel} />
        :  
      <Map 
        level={currentLevel}
        startSession={startSession}
        characters={characters}
        updateCoords={updateCoords}
        pageX={pageX}
        pageY={pageY}
        showTargetBox={showTargetBox}
        showCharacterTargets={showCharacterTargets}
        handleSelect={handleSelect}
        showSnackbar={showSnackbar}
        tick={tick}
        timer={timer}
        message={message}
      />
      }
    </div>
  );
}

export default App;
