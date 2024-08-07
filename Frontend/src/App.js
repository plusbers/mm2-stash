import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
} from "react-router-dom";
import CssBaseline from "@material-ui/core/CssBaseline";
import { getSiteSchema } from "./services/api.service";
import { makeStyles } from "@material-ui/core/styles";
import { Provider } from "react-redux";
import store from "./store";
import { loadUser } from "./actions/auth";
import { ToastProvider } from "react-toast-notifications";
import EventHandler from "./EventHandler";
import { motion } from "framer-motion";
import BackgroundImage from './assets/background.png'

// MUI Components
import Drawer from "@material-ui/core/Drawer";

// Components
import Navbar from "./components/app/Navbar";
import NotFound from "./components/app/404";
import Sidebar from "./components/app/Sidebar";
import Chat from "./components/chat/Chat";
import Preloader from "./Preloader";

// Views
import Home from "./views/Home";
import Affiliates from "./views/Affiliates";
import Profile from "./views/Profile";
import Battles from "./views/Battles";
import Blackjack from "./views/Blackjack";
import Upgrader from "./views/Upgrader";
import BattlePage from "./views/BattlePage";
import Cases from "./views/Cases";
import CasePage from "./views/CasePage";
import Roulette from "./views/Roulette";
import Crash from "./views/Crash";
import Limbo from "./views/Limbo";
import Dice from "./views/Dice";
import Mines from "./views/Mines";
import Slots from './views/Slots';
import SlotDetail from './views/SlotDetail';
import Marketplace from './views/Marketplace'

import Login from "./views/Login";
import Leaderboard from "./views/Leaderboard";
import Provablyfair from "./views/ProvablyFair";
import Banned from "./views/Banned";
import AffiliatesRedirect from "./views/AffiliatesRedirect";
import Maintenance from "./views/Maintenance";

// App Metadata
import metadata from "./metadata.json";
import { styles } from "@material-ui/pickers/views/Calendar/Calendar";

// Styles
const useStyles = makeStyles(theme => ({
  root: {
    backgroundColor: "#0D0F13",
    height: "100%",
    fontFamily: "Poppins",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column"
    },
    [theme.breakpoints.down("md")]: {
      flexDirection: "column"
    },
  },
  chatContainer: {
    background: "",
    display: "flex",
    postition: "relative"
  },
  drawerPaperMinimized: {
    zIndex: 1000000,
    borderRight: "1px solid #282A3A",
    height: "100%",
    padding: "1rem",
    overflowX: "hidden",
    display: "flex",
    overflow: "visible",
    overflowY: "scroll",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#14151D",
    whiteSpace: "nowrap",
    fontFamily: "Poppins",
    position: "relative",
    border: "none",
    width: "80px",
    scrollbarWidth: "none",
    transition: "0.3 ease",
    [theme.breakpoints.down("sm")]: {
      display: "",
    },
    [theme.breakpoints.down("md")]: {
      display: "none",
    },
  },
  drawerPaper2: {
    zIndex: 1000000,
    borderRight: "1px solid #282A3A",
    height: "100%",
    padding: "1rem",
    overflowX: "hidden",
    display: "flex",
    overflow: "visible",
    overflowY: "scroll",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#14151D",
    whiteSpace: "nowrap",
    fontFamily: "Poppins",
    position: "relative",
    border: "none",
    width: "222px",
    zIndex: 4,
    scrollbarWidth: "none",
    transition: "0.3 ease",
    [theme.breakpoints.down("sm")]: {
      display: "",
    },
    [theme.breakpoints.down("md")]: {
      display: "none",
    },
  },
  drawerPaper: {
    zIndex: 2,
    height: "100%",
    padding: "1rem",
    overflowX: "hidden",
    display: "flex",
    overflow: "visible",
    overflowY: "scroll",
    flexDirection: "column",
    background: "#14151D",
    backgroundImage: `url(${BackgroundImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundBlendMode: "overlay",
    whiteSpace: "nowrap",
    borderLeft: "1px solid #282A3A",
    position: "relative",
    border: "none",
    width: 300,
    scrollbarWidth: "none",
    [theme.breakpoints.down("sm")]: {
      display: "",
    },
    [theme.breakpoints.down("md")]: {
      display: "none",
    },
  },
  mobileDrawer: {
    padding: 2,
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    background: "#1D2126",
    position: "absolute",
    whiteSpace: "nowrap",
    width: "100%",
    borderRight: "none",
    height: "100vh",
    maxHeight: "100%",
    [theme.breakpoints.down("xs")]: {
      paddingBottom: 85,
    },
    [theme.breakpoints.up("md")]: {
      display: "none",
    },
  },
  paper: {
    padding: 2,
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },
  body: {
    
    overflow: "hidden",
    flex: "auto",
    display: "flex",
    position: "relative",
    height: "100%",
  },
  content: {
    
    backgroundColor: "", 
    flexGrow: 1,
    // display: "flex",
    overflowY: "auto",
    overfloxX: "hidden",
    padding: "2rem 1rem",
    position: "relative",
    background: "#0E0F15",
    backgroundImage: `url(${BackgroundImage})`,
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundBlendMode: "overlay",
    [theme.breakpoints.down("md")]: {
      margin: 0,
    },
    [theme.breakpoints.down("xs")]: {
      padding: "1rem"
    },
  },
  rightSide: {
    display: "flex",
    flexDirection: "column",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
    [theme.breakpoints.down("md")]: {
      display: "none",
    },
  },
  top: {
    display: "none",
    [theme.breakpoints.down("sm")]: {
      display: "flex",
    },
    [theme.breakpoints.down("md")]: {
      display: "flex",
    },
  },
  chat: {
    position: "absolute",
    bottom: "1.25rem",
    left: "1rem",
    color: "white",
    background: "#4f79fd",
    [theme.breakpoints.up("lg")]: {
      display: "none",
    },
    "&:focus": {
      background: "#4f79fd",
    },
    "&:active": {
      background: "#4f79fd",
    },
  },
  container: {
    height: "100%"
  },
  pulsingGradient: {
    zIndex: -1,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background:
      "linear-gradient(to right, rgba(40, 113, 255, 0.1), rgba(40, 113, 255, 0))",
    overflow: "hidden",
    opacity: 0.8
  },
  innerPulsingGradient: {
    zIndex: -1,
    position: "absolute",
    top: "-50%",
    left: "-50%",
    width: "200%",
    height: "200%",
    background:
      "radial-gradient(circle, rgba(40, 113, 255, 0.1) 0%, rgba(40, 113, 255, 0) 100%)",
    opacity: 0.6,
  },
  switchContainer: {
    transition: 'left 0.2s',
    position: "absolute",
    top: 1.5,
    right: 20
  },
  switch: {
    postition: "relative",
    backgroundColor: "#252734",
    borderRadius: "12px",
    padding: "0.15rem",
    color: "#4D527C",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    width: "40px",
    height: "40px",
    transitionDuration: "300ms",
    "&:hover": {
      filter: "brightness(125%)"
    }
  }
}));

const App = () => {
  const classes = useStyles();

  // Declare state
  const [isSidebarMinimized, setSidebarMinimized] = useState(false);
  const [open] = useState(false);
  const [mobileChat, setMobile] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [finalCountdown, setFinalCountdown] = useState(0);

  // Site settings
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [hidden, setHidden] = useState(false);

  const [isChatVisible, setChatVisible] = useState(true);

  const toggleChat = () => {
    setChatVisible(!isChatVisible);
  };

  const toggleSidebar = () => {
    setSidebarMinimized(!isSidebarMinimized);
  };

  // Modals
  const [terms, setTerms] = useState(false);
  const [fair, setFair] = useState(false);

  const mainMenuAnimate = {
    enter: {
      transition: {
        duration: 0.5,
        ease: "easeInOut"
      },
      display: "flex"
    },
    exit: {
      transition: {
        duration: 0.5,
        ease: "easeInOut"
      },
      transitionEnd: {
        display: "none"
      }
    }
  };

  const subMenuAnimate = {
    enter: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.5,
        ease: "easeInOut"
      },
      display: "flex"
    },
    exit: {
      opacity: 0,
      x: "-100%",
      transition: {
        duration: 0.5,
        ease: "easeInOut"
      },
      transitionEnd: {
        display: "none"
      }
    }
  };

  const switchAnimation = {
    enter: {
      left: "300px",
      opacity: 1,
      transition: {
        duration: 0.1,
        ease: "easeInOut"
      },
      display: "flex"
    },
    exit: {
      left: "0rem",
      transition: {
        duration: 0.5,
        ease: "easeInOut"
      },
    }
  };

  // Fetch site schema from API
  const fetchData = async () => {
    setLoading(true);
    // Coundown stage commences
    await new Promise(resolve => {
      let secunde = 1;
      setFinalCountdown(secunde);
      let int = setInterval(() => {
        secunde -= 1;
        setFinalCountdown(secunde);
        if (secunde <= 0) { clearInterval(int); setFinalCountdown(""); resolve(); }
      }, 1300);
    });
    try {
      const schema = await getSiteSchema();

      // If maintenance is enabled
      if (schema.maintenanceEnabled) {
        setMaintenance(true);
      }

      setLoading(false);
    } catch (error) {
      // If site is on maintenance
      if (error.response && error.response.status === 503) {
        setMaintenance(true);
        setLoading(false);
      } else {
        console.log(error);
        window.location.reload();
      }
    }
  };

  // componentDidMount
  useEffect(() => {
    const buildId = metadata.build;
    const buildNumber = buildId.split("@").length > 1 ? buildId.split("@")[1] : "Unknown";
    console.warn(
      `%cStop!\n%cThis is a browser feature intended only for developers. If someone told you to copy and paste something here to get a "new feature" or "hack" someone's account, it is a scam and will give them access to your account.\r%c[BUILD] Current build number: ${buildNumber}`,
      "font-weight: bold; font-size: 35px; color: red;",
      "color: black; margin-top: 1rem;",
      "color: black; margin-top: 1rem;"
    );
    store.dispatch(loadUser());
    fetchData();
  }, []);

  useEffect(() => {
    // Load user and other data
    store.dispatch(loadUser());
    fetchData();
  }, []);

  return maintenance ? (
    <Maintenance />
  ) : loading ? (
    <Preloader finalCountdown={finalCountdown} />
  ) : (
    <Provider store={store}>
      <Router>
        <ToastProvider
          placement={"bottom-left"}
          autoDismiss={true}
          autoDismissTimeout={4500}
        >
          <EventHandler />

          <div className={classes.root}>
            <CssBaseline />

            <Navbar style={{zIndex: "3"}} toggleChat={toggleChat} />

            <main className={classes.body}>
              <Drawer
                variant="permanent"
                classes={{
                  paper: isSidebarMinimized
                    ? classes.drawerPaperMinimized
                    : classes.drawerPaper2,
                }}
              >
                <Sidebar isMinimized={isSidebarMinimized} />
                <div className={classes.switchContainer}>
                  <div className={classes.switch} onClick={toggleSidebar}>
                    {isSidebarMinimized ? ">" : "<"}
                  </div>
                </div>
              </Drawer>

              {/*<motion.div className={classes.chatContainer}>
                <Drawer
                  variant="permanent"
                  className={mobileChat ? classes.mobileDrawer : classes.drawerPaper}
                  initial="enter"
                  animate={hidden ? "exit" : "enter"}
                  variants={subMenuAnimate}
                >
                  <Chat/>
                </Drawer> */}
                {/*<motion.div 
                  className={classes.switchContainer}
                  variants={switchAnimation}
                  animate={hidden ? "exit" : "enter"}
                >
                  <div className={classes.switch} onClick={() => setHidden(!hidden)} style={{cursor: "pointer"}}>
                    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" ><path d="M7.00004 16.3333H16.3334V13.9999H7.00004V16.3333ZM7.00004 12.8333H21V10.4999H7.00004V12.8333ZM7.00004 9.33326H21V6.99992H7.00004V9.33326ZM2.33337 25.6666V4.66659C2.33337 4.02492 2.56204 3.47542 3.01937 3.01809C3.47671 2.56075 4.02582 2.33248 4.66671 2.33325H23.3334C23.975 2.33325 24.5245 2.56192 24.9819 3.01925C25.4392 3.47659 25.6675 4.0257 25.6667 4.66659V18.6666C25.6667 19.3083 25.438 19.8578 24.9807 20.3151C24.5234 20.7724 23.9743 21.0007 23.3334 20.9999H7.00004L2.33337 25.6666Z" fill="currentColor"></path></svg>
                  </div>
                </motion.div>
              </motion.div>*/}
              

              <div className={classes.content}>
                <Switch >
                  <Redirect exact from="/" to="home" />
                  <Route exact path="/affiliates" component={Affiliates} />
                  <Route exact path="/battles/:battleId" component={BattlePage} />
                  <Route exact path="/battles" component={Battles} />
                  <Route exact path="/blackjack" component={Blackjack} />
                  <Route exact path="/upgrader" component={Upgrader} />
                  <Route exact path="/cases" component={Cases} />
                  <Route exact path="/leaderboard" component={Leaderboard} />
                  <Route exact path="/cases/:caseSlug" component={CasePage} />
                  <Route exact path="/roulette" component={Roulette} />
                  <Route exact path="/crash" component={Crash} />
                  <Route exact path="/limbo" component={Limbo} />
                  <Route exact path="/dice" component={Dice} />
                  <Route exact path='/marketplace' component={Marketplace} />
                <Route exact path="/Mines" component={Mines} />
                <Route exact path="/slots/" component={Slots} />
                <Route exact path="/slots/:identifier2" component={SlotDetail} />

                  <Route exact path="/home" component={Home} />
                  <Route exact path="/provably-fair" component={Provablyfair} />
                  <Route exact path="/profile" component={Profile} />
                  <Route exact path="/banned" component={Banned} />
                  <Route exact path="/a/:affiliateCode" component={AffiliatesRedirect} />
                  <Route exact path="/login/:provider?" component={Login} />

                  <Route exact path="*" component={NotFound} />
                </Switch>
              </div> 

              {!isChatVisible ? (
                <></>
              ) : (
                <Drawer
                    variant="permanent"
                    classes={{
                      paper: mobileChat ? classes.mobileDrawer : classes.drawerPaper,
                    }}
                    className={classes.chatContainer}
                    open={open}
                  >
                    <Chat />
                </Drawer>
              )}
            </main>
          </div>
        </ToastProvider>
      </Router>
    </Provider>
  );
};

export default App;
