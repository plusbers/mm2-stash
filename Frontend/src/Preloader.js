import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";

// Assets
import logo from "./assets/navbar/logo.svg";

// Custom styles
const useStyles = makeStyles(() => ({
  root: {
    height: "100%",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#14151D",
  },
  img: {
    width: "15rem",
    animation: "beat 1.5s ease infinite",
  },
  "@keyframes beat": {
    "0%, 100%": {
      transform: "scale(1)",
    },
    "50%": {
      transform: "scale(1.2)",
    },
  },
}));

const Preloader = () => {
  const classes = useStyles();

  return (
    <Box className={classes.root}>
      <img src={logo} alt="Logo" className={classes.img} />
    </Box>
  );
};

export default Preloader;