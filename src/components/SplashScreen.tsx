import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  show: boolean;
}

const SplashScreen = ({ show }: SplashScreenProps) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
        >
          {/* Grid overlay */}
          <div className="absolute inset-0 grid-overlay opacity-30" />

          {/* Glow effect */}
          <div className="absolute w-64 h-64 rounded-full bg-primary/10 blur-[100px]" />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative flex flex-col items-center gap-6"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-[0_0_40px_hsl(18_100%_59%/0.4)]"
            >
              <img src="/brand-logo.svg" alt="PraNaga Logo" className="w-full h-full object-contain rounded-2xl" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-center"
            >
              <h1 className="text-3xl font-heading font-bold tracking-wide">
                <span className="text-foreground">Pra</span>
                <span className="text-primary">Naga</span>
              </h1>
              <p className="text-xs font-heading tracking-[0.3em] text-muted-foreground mt-2 uppercase">
                Command Center
              </p>
            </motion.div>

            {/* Loading bar */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 160 }}
              transition={{ delay: 0.5, duration: 1.2, ease: "easeInOut" }}
              className="h-[2px] bg-gradient-to-r from-primary/0 via-primary to-primary/0 rounded-full"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
